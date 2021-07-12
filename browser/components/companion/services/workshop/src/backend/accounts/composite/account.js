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

/* eslint-disable no-prototype-builtins */
/**
 * Configurator for fake
 **/

import logic from "logic";
import $acctmixins from "../../accountmixins";
import * as $imapacct from "../imap/account";
import * as $pop3acct from "../pop3/account";
import * as $smtpacct from "../smtp/account";
import allback from "shared/allback";

var PIECE_ACCOUNT_TYPE_TO_CLASS = {
  imap: $imapacct.ImapAccount,
  pop3: $pop3acct.Pop3Account,
  smtp: $smtpacct.SmtpAccount,
};

/**
 * Composite account type to expose account piece types with individual
 * implementations (ex: imap, smtp) together as a single account.  This is
 * intended to be a very thin layer that shields consuming code from the
 * fact that IMAP and SMTP are not actually bundled tightly together.
 */
export default function CompositeAccount(
  universe,
  accountDef,
  foldersTOC,
  dbConn,
  receiveProtoConn
) {
  this.universe = universe;
  this.id = accountDef.id;
  this.accountDef = accountDef;
  logic.defineScope(this, "Account", { accountId: this.id });

  // Currently we don't persist the disabled state of an account because it's
  // easier for the UI to be edge-triggered right now and ensure that the
  // triggering occurs once each session.
  this._enabled = true;
  this.problems = [];

  // For oauth2, hold on to a "last renew attempt" timestamp. However, since it
  // uses performance.now() that can be reset depending on clock time and
  // environment (shared worker always resets to 0 for instance), always reset
  // the value here to 0. It is just a transient timestamp that is useful
  // during the lifetime of the app.
  if (accountDef.credentials && accountDef.credentials.oauth2) {
    accountDef.credentials.oauth2._transientLastRenew = 0;
  }

  this.identities = accountDef.identities;

  if (!PIECE_ACCOUNT_TYPE_TO_CLASS.hasOwnProperty(accountDef.receiveType)) {
    logic(this, "badAccountType", { type: accountDef.receiveType });
  }
  if (!PIECE_ACCOUNT_TYPE_TO_CLASS.hasOwnProperty(accountDef.sendType)) {
    logic(this, "badAccountType", { type: accountDef.sendType });
  }

  this._receivePiece = new PIECE_ACCOUNT_TYPE_TO_CLASS[accountDef.receiveType](
    universe,
    this,
    accountDef.id,
    accountDef.credentials,
    accountDef.receiveConnInfo,
    foldersTOC,
    dbConn,
    receiveProtoConn
  );
  this._sendPiece = new PIECE_ACCOUNT_TYPE_TO_CLASS[accountDef.sendType](
    universe,
    this,
    accountDef.id,
    accountDef.credentials,
    accountDef.sendConnInfo,
    dbConn
  );

  // XXX this hiding and all that just ended up confusing.  FIX IT.
  // XXX and now I'm making this worse since both can't be true.
  this.imapAccount = this._receivePiece;
  this.popAccount = this._receivePiece;
  this.smtpAccount = this._sendPiece;

  // expose public lists that are always manipulated in place.
  this.folders = this._receivePiece.folders;
}
CompositeAccount.prototype = {
  toString() {
    return "[CompositeAccount: " + this.id + "]";
  },
  get supportsServerFolders() {
    return this._receivePiece.supportsServerFolders;
  },
  toBridgeFolder() {
    return {
      id: this.accountDef.id,
      name: this.accountDef.name,
      path: this.accountDef.name,
      type: "account",
    };
  },

  // TODO: evaluate whether the account actually wants to be a RefedResource
  // with some kind of reaping if all references die and no one re-acquires it
  // within some timeout horizon.
  __acquire() {
    return Promise.resolve(this);
  },
  __release() {},

  get enabled() {
    return this._enabled;
  },
  set enabled(val) {
    this._enabled = this._receivePiece.enabled = val;
  },

  get foldersTOC() {
    return this._receivePiece.foldersTOC;
  },

  get pimap() {
    return this._receivePiece.pimap;
  },

  allOperationsCompleted() {
    if (this._receivePiece.allOperationsCompleted) {
      this._receivePiece.allOperationsCompleted();
    }
  },

  /**
   * Check that the account is healthy in that we can login at all.
   * We'll check both the incoming server and the SMTP server; for
   * simplicity, the errors are returned as follows:
   *
   *   callback(incomingErr, outgoingErr);
   *
   * If you don't want to check both pieces, you should just call
   * checkAccount on the receivePiece or sendPiece as appropriate.
   */
  checkAccount(callback) {
    var latch = allback.latch();
    this._receivePiece.checkAccount(latch.defer("incoming"));
    this._sendPiece.checkAccount(latch.defer("outgoing"));
    latch.then(function(results) {
      callback(results.incoming[0], results.outgoing[0]);
    });
  },

  /**
   * Shutdown the account; see `MailUniverse.shutdown` for semantics.
   */
  shutdown(callback) {
    this._sendPiece.shutdown();
    this._receivePiece.shutdown(callback);
  },

  accountDeleted() {
    this._sendPiece.accountDeleted();
    this._receivePiece.accountDeleted();
  },

  deleteFolder(folderId, callback) {
    return this._receivePiece.deleteFolder(folderId, callback);
  },

  sliceFolderMessages(folderId, bridgeProxy) {
    return this._receivePiece.sliceFolderMessages(folderId, bridgeProxy);
  },

  searchFolderMessages(folderId, bridgeHandle, phrase, whatToSearch) {
    return this._receivePiece.searchFolderMessages(
      folderId,
      bridgeHandle,
      phrase,
      whatToSearch
    );
  },

  syncFolderList(callback) {
    return this._receivePiece.syncFolderList(callback);
  },

  sendMessage(composer, callback) {
    return this._sendPiece.sendMessage(
      composer,
      function(err, errDetails) {
        if (!err) {
          // The saving is done asynchronously as a best-effort.
          this._receivePiece.saveSentMessage(composer);
        }
        callback(err, errDetails, null);
      }.bind(this)
    );
  },

  runOp(op, mode, callback) {
    return this._receivePiece.runOp(op, mode, callback);
  },

  /**
   * Kick off jobs to create required folders, both locally and on the
   * server. See imap/account.js and activesync/account.js for documentation.
   *
   * @param {function} callback
   *   Called when all jobs have run.
   */
  ensureEssentialOnlineFolders(callback) {
    return this._receivePiece.ensureEssentialOnlineFolders(callback);
  },

  ensureEssentialOfflineFolders(callback) {
    return this._receivePiece.ensureEssentialOfflineFolders(callback);
  },

  getFirstFolderWithType: $acctmixins.getFirstFolderWithType,

  getFolderById: $acctmixins.getFolderById,

  upgradeFolderStoragesIfNeeded() {
    for (var key in this._receivePiece._folderStorages) {
      var storage = this._receivePiece._folderStorages[key];
      storage.upgradeIfNeeded();
    }
  },
};
