/**
 * Copyright 2021 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import logic from "logic";
import * as $mailchewStrings from "./bodies/mailchew_strings";

import { BridgeContext } from "./bridge/bridge_context";
import { BatchManager } from "./bridge/batch_manager";

import EntireListProxy from "./bridge/entire_list_proxy";
import WindowedListProxy from "./bridge/windowed_list_proxy";
import { TEST_LetsDoTheTimewarpAgain } from "shared/date";
import { TEST_parseFeed } from "./parsers/parsers";

/**
 * There is exactly one `MailBridge` instance for each `MailAPI` instance.
 * `same-frame-setup.js` is the only place that hooks them up together right
 * now.
 */
export default function MailBridge(universe, db, name) {
  logic.defineScope(this, "MailBridge", { name });
  this.name = name;
  this.universe = universe;
  // If you're thinking of registering listeners on the universe, please check
  // out MailUniverse.registerBridge and MailUniverse.broadcastOverBridges
  // before committing to any design choices.
  this.universe.registerBridge(this);
  this.db = db;

  this.batchManager = new BatchManager(db);
  this.bridgeContext = new BridgeContext({
    bridge: this,
    batchManager: this.batchManager,
    taskGroupTracker: this.universe.taskGroupTracker,
    dataOverlayManager: this.universe.dataOverlayManager,
  });
}
MailBridge.prototype = {
  /**
   * Currently should be invoked when the MessagePort tells us it's going away.
   *
   * TODO: In the future we may instead want to use a WebLock (once implemented)
   * where the MailAPI in the front-end holds a lock that we're waiting on.
   * When the MailAPI instance gets collected due to being forgotten or because
   * the global terminates, we would acquire the lock which lets us know to
   * perform a shutdown.  This will require the frontend/backend to coordinate
   * on the lock names.  Currently the mechanism for `logic` `tid` allocation
   * should be sufficient.
   */
  shutdown() {
    this.bridgeContext.shutdown();
  },

  __sendMessage() {
    throw new Error("This is supposed to get hidden by an instance var.");
  },

  /**
   * Synchronously process incoming messages; the processing may be async.
   *
   * There are 2 orthogonal clever things that may go on here:
   * - "promised" requests are sent via `_sendPromisedRequest` and are a means
   *   of letting individual requests return promises.  In detail:
   *   - Using `_sendPromisedRequest` results in the underlying message (which
   *     can use a `handle` as it normally would) being wrapped so that a
   *     separate handle is allocated just for the promised request.  This means
   *     that `refreshView` can be used on a view that has a `handle` associated
   *     with a `namedContext` but also still separately indicate when the
   *     refresh completes.
   *   - Using `_sendPromisedRequest` means that the handling function on this
   *     class will be `_promised_MESSAGETYPE` instead of `_cmd_MESSAGETYPE`.
   *     The handler will take a second argument which is `replyFunc`, a helper
   *     that ensures that we send at most one "promisedResult".  This helper
   *     can be invoked whenever you want; if the `_promised_MESSAGETYPE`
   *     handler is async or otherwise returns a promise, there is no required
   *     ordering of when that promise resolves and when you invoke replyFunc.
   * - named contexts will have their requests serialized if the command returns
   *   a Promise.
   *   - Note that in cases where you don't want requests serialized but you
   *     have a `_promised_FOO` handler, this may mean that you need to avoid
   *     using `async` directly on your handling function even if it makes it
   *     cleaner to call the `replyFunc`.  For example, you can use promises
   *     internally or an internal async function so that the caller does not
   *     see a promise returned.
   *
   * More details:
   *
   * TODO: be clever about serializing commands on a per-handle basis so that
   * we can maintain a logical ordering of data-dependent commands but not have
   * long-running commands interfering with orthogonal things.  For instance,
   * we should not process seek() commands for a list view until the command
   * creating the list view has been fully processed.
   */
  __receiveMessage(msg) {
    let replyFunc = undefined;
    let implCmdName;
    if (msg.type === "promised") {
      const promisedHandle = msg.handle;
      let repliedAlready = false;
      replyFunc = data => {
        if (repliedAlready) {
          return;
        }
        this.__sendMessage({
          type: "promisedResult",
          handle: promisedHandle,
          data,
        });
        repliedAlready = true;
      };
      // pierce the wrapping.
      msg = msg.wrapped;
      implCmdName = `_promised_${msg.type}`;
    } else {
      implCmdName = `_cmd_${msg.type}`;
    }

    if (!(implCmdName in this)) {
      logic(this, "badMessageTypeError", { type: msg.type });
      return;
    }
    try {
      let namedContext =
        msg.handle && this.bridgeContext.maybeGetNamedContext(msg.handle);
      if (namedContext) {
        if (namedContext.pendingCommand) {
          namedContext.commandQueue.push([msg, implCmdName, replyFunc]);
        } else {
          let promise = (namedContext.pendingCommand = this._processCommand(
            msg,
            implCmdName,
            replyFunc
          ));
          if (promise) {
            this._trackCommandForNamedContext(namedContext, promise);
          }
        }
      } else {
        let promise = this._processCommand(msg, implCmdName, replyFunc);
        // If the command went async, then it's also possible that the command
        // grew a namedContext and that we therefore need to get it and set up the
        // bookkeeping so that if any other commands come in on this handle before
        // the promise is resolved that we can properly queue them.
        if (promise && msg.handle) {
          namedContext = this.bridgeContext.maybeGetNamedContext(msg.handle);
          if (namedContext) {
            namedContext.pendingCommand = promise;
            this._trackCommandForNamedContext(namedContext, promise);
          }
        }
      }
    } catch (ex) {
      logic(this, "cmdError", { type: msg.type, ex, stack: ex.stack });
    }
  },

  _trackCommandForNamedContext(namedContext, promise) {
    let successNext = () => {
      this._commandCompletedProcessNextCommandInQueue(namedContext);
    };
    let errorNext = err => {
      logic(this, "cmdAsyncError", { err, stack: err.stack });
      this._commandCompletedProcessNextCommandInQueue(namedContext);
    };
    promise.then(successNext, errorNext);
  },

  _commandCompletedProcessNextCommandInQueue(namedContext) {
    if (namedContext.commandQueue.length) {
      let promise = (namedContext.pendingCommand = this._processCommand(
        ...namedContext.commandQueue.shift()
      ));
      if (promise) {
        let runNext = () => {
          this._commandCompletedProcessNextCommandInQueue(namedContext);
        };
        promise.then(runNext, runNext);
      }
    } else {
      namedContext.pendingCommand = null;
    }
  },

  /**
   * Used by MailUniverse.broadcastOverBridges to send a message to the MailAPI
   * instance to be emitted.
   */
  broadcast(name, data) {
    this.__sendMessage({
      type: "broadcast",
      payload: { name, data },
    });
  },

  /**
   *
   * @param {Object} msg
   * @param {String} [implCmdName]
   *   The command name optionally already derived from the message.  Optional
   *   because in some cases the string may already have been created for
   *   fast-fail purposes and still available.  In async cases we may not have
   *   it anymore because it's not worth the hassle to cart it around.
   */
  _processCommand(msg, implCmdName, replyFunc) {
    logic(this, "cmd", {
      type: msg.type,
      msg,
    });
    try {
      let result = this[implCmdName](msg, replyFunc);
      if (result && result.then) {
        logic.await(this, "asyncCommand", { type: msg.type }, result);
        return result;
      }
    } catch (ex) {
      console.error("problem processing", implCmdName, ex, ex.stack);
      logic.fail(ex);
      return null; // note that we did not throw
    }
    return null;
  },

  _cmd_ping(msg) {
    this.__sendMessage({
      type: "pong",
      handle: msg.handle,
    });
  },

  _cmd_TEST_timeWarp(msg) {
    logic(this, "timeWarp", { fakeNow: msg.fakeNow });
    TEST_LetsDoTheTimewarpAgain(msg.fakeNow);
  },

  async _promised_TEST_parseFeed(msg, replyFunc) {
    logic(this, "parseFeed", {
      parserType: msg.parserType,
      code: `${msg.code.slice(0, 128)}...`,
    });
    const data = await TEST_parseFeed(msg.parserType, msg.code, msg.url);
    replyFunc(data);
  },

  _cmd_setInteractive(/*msg*/) {
    this.universe.setInteractive();
  },

  _cmd_localizedStrings(msg) {
    $mailchewStrings.set(msg.strings);
  },

  _promised_learnAboutAccount(msg, replyFunc) {
    this.universe.learnAboutAccount(msg.details).then(
      info => {
        replyFunc(info);
      },
      (/*err*/) => {
        replyFunc({ result: "no-config-info", configInfo: null });
      }
    );
  },

  _promised_tryToCreateAccount(msg, replyFunc) {
    this.universe
      .tryToCreateAccount(msg.userDetails, msg.domainInfo)
      .then(result => {
        replyFunc(result);
      });
  },

  async _promised_syncFolderList(msg, replyFunc) {
    await this.universe.syncFolderList(msg.accountId, "bridge");
    replyFunc(null);
  },

  async _promised_modifyFolder(msg, replyFunc) {
    await this.universe.modifyFolder(msg.accountId, msg.mods, "bridge");
    replyFunc(null);
  },

  async _cmd_clearAccountProblems(msg) {
    var account = this.universe.getAccountForAccountId(msg.accountId),
      self = this;
    let [incomingErr, outgoingErr] = await account.checkAccount();

    // Note that ActiveSync accounts won't have an outgoingError,
    // but that's fine. It just means that outgoing never errors!
    let canIgnoreError = function(err) {
      // If we succeeded or the problem was not an authentication,
      // assume everything went fine. This includes the case we're
      // offline.
      return (
        !err ||
        (err !== "bad-user-or-pass" &&
          err !== "bad-address" &&
          err !== "needs-oauth-reauth" &&
          err !== "imap-disabled")
      );
    };
    if (canIgnoreError(incomingErr) && canIgnoreError(outgoingErr)) {
      self.universe.clearAccountProblems(account);
    }
    self.__sendMessage({
      type: "clearAccountProblems",
      handle: msg.handle,
    });
  },

  async _promised_modifyConfig(msg, replyFunc) {
    await this.universe.modifyConfig(msg.mods, "bridge");
    replyFunc(null);
  },

  async _promised_modifyAccount(msg, replyFunc) {
    await this.universe.modifyAccount(msg.accountId, msg.mods, "bridge");
    replyFunc(null);
  },

  _cmd_recreateAccount(msg) {
    this.universe.recreateAccount(msg.accountId, "bridge");
  },

  async _promised_deleteAccount(msg, replyFunc) {
    await this.universe.deleteAccount(msg.accountId, "bridge");
    replyFunc(null);
  },

  async _promised_modifyIdentity(msg, replyFunc) {
    await this.universe.modifyIdentity(msg.identityId, msg.mods, "bridge");
    replyFunc(null);
  },

  /**
   * Notify the frontend that login failed.
   *
   * @param account
   * @param {string} problem
   * @param {'incoming'|'outgoing'} whichSide
   */
  notifyBadLogin(account, problem, whichSide) {
    this.__sendMessage({
      type: "badLogin",
      account: account.toBridgeWire(),
      problem,
      whichSide,
    });
  },

  _cmd_requestBodies(msg) {
    var self = this;
    this.universe.downloadBodies(msg.messages, msg.options, function() {
      self.__sendMessage({
        type: "requestBodiesComplete",
        handle: msg.handle,
        requestId: msg.requestId,
      });
    });
  },

  async _cmd_viewAccounts(msg) {
    let ctx = this.bridgeContext.createNamedContext(msg.handle, "AccountsView");

    let toc = await this.universe.acquireAccountsTOC(ctx);

    ctx.proxy = new EntireListProxy(toc, ctx);
    await ctx.acquire(ctx.proxy);
    ctx.proxy.populateFromList();
  },

  async _cmd_viewFolders(msg) {
    let ctx = this.bridgeContext.createNamedContext(msg.handle, "FoldersView");

    let toc = await this.universe.acquireAccountFoldersTOC(ctx, msg.accountId);

    ctx.proxy = new EntireListProxy(toc, ctx);
    await ctx.acquire(ctx.proxy);
    ctx.proxy.populateFromList();
  },

  async _cmd_viewRawList(msg) {
    let ctx = this.bridgeContext.createNamedContext(msg.handle, "RawListView");
    ctx.viewing = {
      type: "raw",
      namespace: msg.namespace,
      name: msg.name,
    };
    let toc = await this.universe.acquireExtensionTOC(
      ctx,
      msg.namespace,
      msg.name
    );

    ctx.proxy = new WindowedListProxy(toc, ctx);
    await ctx.acquire(ctx.proxy);
  },

  async _cmd_viewFolderConversations(msg) {
    let ctx = this.bridgeContext.createNamedContext(
      msg.handle,
      "FolderConversationsView"
    );
    ctx.viewing = {
      type: "folder",
      folderId: msg.folderId,
    };
    let toc = await this.universe.acquireFolderConversationsTOC(
      ctx,
      msg.folderId
    );
    ctx.proxy = new WindowedListProxy(toc, ctx);
    await ctx.acquire(ctx.proxy);
    this.universe.syncRefreshFolder(msg.folderId, "viewFolderConversations");
  },

  async _cmd_searchFolderConversations(msg) {
    let ctx = this.bridgeContext.createNamedContext(
      msg.handle,
      "FolderConversationsSearchView"
    );
    ctx.viewing = {
      type: "folder",
      folderId: msg.spec.folderId,
    };
    let spec = msg.spec;
    if (msg.viewDefsWithHandles) {
      let viewDefsWithContexts = msg.viewDefsWithHandles.map(
        ({ handle, viewDef }) => {
          let viewCtx = this.bridgeContext.createNamedContext(
            handle,
            "DerivedView",
            ctx
          );
          viewCtx.viewing = {
            type: "derived",
          };
          // It's up to the `DerivedViewManager` to call a provider to provide
          // a TOC and derived view and bind the TOC to a proxy.
          return { ctx: viewCtx, viewDef };
        }
      );
      spec = Object.assign({}, spec, { viewDefsWithContexts });
    }
    let toc = await this.universe.acquireSearchConversationsTOC(ctx, spec);
    ctx.proxy = new WindowedListProxy(toc, ctx);
    await ctx.acquire(ctx.proxy);
  },

  async _cmd_viewFolderMessages(msg) {
    let ctx = this.bridgeContext.createNamedContext(
      msg.handle,
      "FolderMessagesView"
    );
    ctx.viewing = {
      type: "folder",
      folderId: msg.folderId,
    };
    let toc = await this.universe.acquireFolderMessagesTOC(ctx, msg.folderId);
    ctx.proxy = new WindowedListProxy(toc, ctx);
    await ctx.acquire(ctx.proxy);
    this.universe.syncRefreshFolder(msg.folderId, "viewFolderMessages");
  },

  async _cmd_searchFolderMessages(msg) {
    const ctx = this.bridgeContext.createNamedContext(
      msg.handle,
      "FolderMessagesSearchView"
    );
    ctx.viewing = {
      type: "folder",
      folderId: msg.spec.folderId,
    };
    const toc = await this.universe.acquireSearchMessagesTOC(ctx, msg.spec);
    ctx.proxy = new WindowedListProxy(toc, ctx);
    await ctx.acquire(ctx.proxy);
  },

  async _cmd_searchAccountMessages(msg) {
    const ctx = this.bridgeContext.createNamedContext(
      msg.handle,
      "AccountMessagesSearchView"
    );
    ctx.viewing = {
      type: "account",
      accountId: msg.spec.accountId,
    };
    const toc = await this.universe.acquireSearchAccountMessagesTOC(
      ctx,
      msg.spec
    );
    ctx.proxy = new WindowedListProxy(toc, ctx);
    await ctx.acquire(ctx.proxy);
  },

  async _promised_refreshAllFoldersList(msg, replyFunc) {
    const allAccountIds = this.universe.getAllAccountIdsWithKind(msg.spec.kind);
    await Promise.all(
      allAccountIds.map(accountId =>
        this.universe.syncFolderList(accountId, "bridge")
      )
    );
    replyFunc(null);
  },

  async _cmd_searchAllMessages(msg) {
    const ctx = this.bridgeContext.createNamedContext(
      msg.handle,
      "AllSearchView"
    );
    const allAccountIds = (msg.spec.accountIds = this.universe.getAllAccountIdsWithKind(
      msg.spec.kind
    ));
    ctx.viewing = {
      type: "account",
      accountId: allAccountIds,
    };
    const toc = await this.universe.acquireSearchAllAccountsMessagesTOC(
      ctx,
      msg.spec
    );
    ctx.proxy = new WindowedListProxy(toc, ctx);
    await ctx.acquire(ctx.proxy);
  },

  async _promised_refreshAllMessages(msg, replyFunc) {
    const spec = msg.spec;
    const accountIds = this.universe.getAllAccountIdsWithKind(spec.kind);
    const metaHelpers = [];
    const refreshHelpers = [];
    spec.folderIds = [];

    for (let accountId of accountIds) {
      this.universe.__acquireSearchFoldersHelper(
        accountId,
        spec,
        metaHelpers,
        refreshHelpers
      );
    }

    let promises = refreshHelpers.map(helper => helper("sync-all-messages"));
    await Promise.all(promises);
    replyFunc(null);
  },

  async _cmd_viewConversationMessages(msg) {
    let ctx = this.bridgeContext.createNamedContext(
      msg.handle,
      "ConversationMessagesView"
    );
    ctx.viewing = {
      type: "conversation",
      conversationId: msg.conversationId,
    };
    let toc = await this.universe.acquireConversationTOC(
      ctx,
      msg.conversationId
    );
    ctx.proxy = new WindowedListProxy(toc, ctx);
    await ctx.acquire(ctx.proxy);
  },

  async _cmd_searchConversationMessages(msg) {
    let ctx = this.bridgeContext.createNamedContext(
      msg.handle,
      "ConversationSearchView"
    );
    ctx.viewing = {
      type: "conversation",
      conversationId: msg.conversationId,
    };
    let toc = await this.universe.acquireSearchConversationMessagesTOC(
      ctx,
      msg.spec
    );
    ctx.proxy = new WindowedListProxy(toc, ctx);
    await ctx.acquire(ctx.proxy);
  },

  async _promised_refreshView(msg, replyFunc) {
    let ctx = this.bridgeContext.getNamedContextOrThrow(msg.handle);
    await ctx.proxy?.toc?.refresh("refreshView");
    replyFunc(null);
  },

  _cmd_growView(msg) {
    let ctx = this.bridgeContext.getNamedContextOrThrow(msg.handle);
    if (ctx.viewing.type === "folder") {
      this.universe.syncGrowFolder(ctx.viewing.folderId, "growView");
    } else {
      // TODO: growing for conversations is nonsensical under gmail, but has
      // clear backfilling ramifications for other account types
    }
  },

  _cmd_seekProxy(msg) {
    let ctx = this.bridgeContext.getNamedContextOrThrow(msg.handle);
    ctx.proxy.seek(msg);
  },

  async _cmd_getItemAndTrackUpdates(msg) {
    // XXX implement priority tags support

    // - Fetch the raw data from disk
    let requests = {};
    let idRequestMap = new Map();
    idRequestMap.set(msg.itemId, null);
    // Helper to normalize raw database reps to wire reps.  This matters for
    // things like account info structures.
    let rawToWireRep, eventArgsToRaw;
    // the normalized id of what we're tracking.  (exists because we pass
    // the [messageId, date] tuple for 'msg', which maybe we should pass as a
    // separate arg instead...
    let normId;
    // readKey is the key in the results of the read where our result map is.
    // messages is again special, since the results are keyed by id despite the
    // requests being keyed by the tuple.  (Otherwise reads all reuse their
    // request map anyways.)
    let readKey;
    switch (msg.itemType) {
      case "conv":
        normId = msg.itemId;
        requests.conversations = idRequestMap;
        readKey = "conversations";
        // no transformation is performed on conversation reps
        rawToWireRep = x => x;
        // The change idiom is currently somewhat one-off; we may be able to
        // just fold this into the eventHandler once things stabilize.
        eventArgsToRaw = (id, convInfo) => {
          return convInfo;
        };
        break;
      case "msg":
        normId = msg.itemId[0];
        requests.messages = idRequestMap;
        readKey = "messages";
        rawToWireRep = x => x;
        eventArgsToRaw = (id, messageInfo) => {
          return messageInfo;
        };
        break;
      default:
        throw new Error("unsupported item type: " + msg.itemType);
    }
    let eventId = msg.itemType + "!" + normId + "!change";
    let ctx = this.bridgeContext.createNamedContext(msg.handle, eventId);

    let fromDb = await this.db.read(ctx, requests);

    // Normalize to wire rep form
    let dbWireRep = rawToWireRep(fromDb[readKey].get(normId));

    const dataOverlayManager = this.universe.dataOverlayManager;
    let boundOverlayResolver = dataOverlayManager.makeBoundResolver(readKey);

    // - Register an event listener that will be removed at context cleanup
    // (We only do this after we have loaded the up-to-date rep.  Note that
    // under the current DB implementation there is a potential short-lived
    // race here that will be addressed to support this idiom correctly.)
    let dataEventHandler = (arg1, arg2) => {
      let rep = eventArgsToRaw(arg1, arg2);
      if (rep) {
        // an update!
        rep = rawToWireRep(rep);
        ctx.sendMessage("updateItem", {
          state: rep,
          // (the overlay will trigger independently)
          overlays: null,
        });
      } else {
        // a deletion!
        ctx.sendMessage("updateItem", null);
      }
    };
    let overlayEventHandler = modId => {
      // (this is an unfiltered firehose event, it might make sense to have the
      // DataOverlayManager have an id-specific setup too.)
      if (modId === normId) {
        // if it's just the overlays changing, we can send that update without
        // re-sending (or re-reading) the data.  We convey this by
        ctx.sendMessage("updateItem", {
          state: null,
          overlays: boundOverlayResolver(normId),
        });
      }
    };
    this.db.on(eventId, dataEventHandler);
    dataOverlayManager.on(readKey, overlayEventHandler);
    ctx.runAtCleanup(() => {
      this.db.removeListener(eventId, dataEventHandler);
      dataOverlayManager.removeListener(readKey, overlayEventHandler);
    });

    // - Send the wire rep
    ctx.sendMessage("gotItemNowTrackingUpdates", {
      state: dbWireRep,
      overlays: boundOverlayResolver(normId),
    });
  },

  _cmd_updateTrackedItemPriorityTags(/*msg*/) {
    // XXX implement priority tags support
  },

  _cmd_cleanupContext(msg) {
    this.bridgeContext.cleanupNamedContext(msg.handle);

    this.__sendMessage({
      type: "contextCleanedUp",
      handle: msg.handle,
    });
  },

  _cmd_fetchSnippets(msg) {
    if (msg.convIds) {
      this.universe.fetchConversationSnippets(msg.convIds, "bridge");
    }
  },

  _cmd_downloadBodyReps(msg) {
    this.universe.fetchMessageBody(msg.id, msg.date, "bridge");
  },

  async _promised_downloadAttachments(msg, replyFunc) {
    await this.universe.downloadMessageAttachments(msg.downloadReq);
    replyFunc(null);
  },

  //////////////////////////////////////////////////////////////////////////////
  // Message Mutation
  //
  // All mutations are told to the universe which breaks the modifications up on
  // a per-account basis.

  /**
   * Helper for undoable operations.  For use in calls where the MailUniverse
   * calls return a Promise that gets resolved with a list of tasks to be
   * invoked to undo the effects of the just-planned task.  Handles flattening
   * the array of arrays and the very limited promisedResult boilerplate.
   */
  __accumulateUndoTasksAndReply(sourceMsg, promises, replyFunc) {
    Promise.all(promises).then(nestedUndoTasks => {
      // Have concat do the flattening for us.
      let undoTasks = [];
      undoTasks = undoTasks.concat.apply(undoTasks, nestedUndoTasks);

      replyFunc(undoTasks);
    });
  },

  _promised_store_labels(msg, replyFunc) {
    this.__accumulateUndoTasksAndReply(
      msg,
      msg.conversations.map(convInfo => {
        return this.universe.storeLabels(
          convInfo.id,
          convInfo.messageIds,
          convInfo.messageSelector,
          msg.add,
          msg.remove
        );
      }),
      replyFunc
    );
  },

  _promised_store_flags(msg, replyFunc) {
    this.__accumulateUndoTasksAndReply(
      msg,
      msg.conversations.map(convInfo => {
        return this.universe.storeFlags(
          convInfo.id,
          convInfo.messageIds,
          convInfo.messageSelector,
          msg.add,
          msg.remove
        );
      }),
      replyFunc
    );
  },

  async _promised_outboxSetPaused(msg, replyFunc) {
    await this.universe.outboxSetPaused(msg.accountId, msg.bePaused);
    replyFunc();
  },

  _cmd_undo(msg) {
    this.universe.undo(msg.undoTasks);
  },

  //////////////////////////////////////////////////////////////////////////////
  // Composition

  async _promised_createDraft(msg, replyFunc) {
    let { messageId, messageDate } = await this.universe.createDraft({
      draftType: msg.draftType,
      mode: msg.mode,
      refMessageId: msg.refMessageId,
      refMessageDate: msg.refMessageDate,
      folderId: msg.folderId,
    });
    replyFunc({ messageId, messageDate });
  },

  _cmd_attachBlobToDraft(msg) {
    this.universe.attachBlobToDraft(msg.messageId, msg.attachmentDef);
  },

  _cmd_detachAttachmentFromDraft(msg) {
    this.universe.detachAttachmentFromDraft(msg.messageId, msg.attachmentRelId);
  },

  /**
   * Save a draft, delete a draft, or try and send a message.
   *
   * Drafts are saved in our IndexedDB storage. This is notable because we are
   * told about attachments via their Blobs.
   */
  _promised_doneCompose(msg, replyFunc) {
    // Delete and be done if delete.
    if (msg.command === "delete") {
      this.universe.deleteDraft(msg.messageId);
      return;
    }

    // We must be 'save' or 'send', so we want to save.
    this.universe.saveDraft(msg.messageId, msg.draftFields);
    // Actually send if send.
    if (msg.command === "send") {
      this.universe.outboxSendDraft(msg.messageId).then(sendProblem => {
        replyFunc(sendProblem);
      });
    }
  },

  _cmd_clearNewTrackingForAccount(msg) {
    this.universe.clearNewTrackingForAccount({
      accountId: msg.accountId,
      silent: msg.silent,
    });
  },

  _cmd_flushNewAggregates() {
    this.universe.flushNewAggregates();
  },

  //////////////////////////////////////////////////////////////////////////////
  // Debug Stuff

  _cmd_debugForceCronSync(msg) {
    this.universe.cronSyncSupport.onAlarm(
      msg.accountIds,
      "fake-interval", // this is not a real sync and the logic doesn't care.
      "fake-wakelock", // uh, so, this could end badly...
      msg.notificationAccountIds
    );
  },
};
