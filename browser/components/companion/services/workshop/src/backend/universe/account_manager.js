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

import { accountIdFromFolderId } from "shared/id_conversions";

import {
  accountModules,
  engineTaskMappings,
  engineBackEndFacts,
} from "../engine_glue";

import { AccountsTOC } from "../db/accounts_toc";
import { FoldersTOC } from "../db/folders_toc";

/**
 * Helper function that takes a function(id) {} and causes it to return any
 * existing promise with that id in this[mapPropName].  If there was no promise,
 * we invoke the function.
 *
 * This is an attempt to reduce boilerplate while also allowing for very
 * explicit function names indicating what's being loaded, etc.
 *
 * @param {String} mapPropName
 * @param {Function} func
 * @param {Boolean} forgetOnResolve
 *   Should we delete the promise from the map when it resolves?  This should
 *   be used in cases where the results are maintained in some other canonical
 *   map and us hanging onto the Promise could potentially result in a memory
 *   leak.  Arguably it would be better if we expanded this helper mechanism to
 *   also manage the canonical map too with clear life-cycles.  But things work
 *   as-is.
 */
function prereqify(mapPropName, func, forgetOnResolve) {
  return function(id) {
    const map = this[mapPropName];
    let promise = map.get(id);
    if (promise) {
      return promise;
    }

    try {
      promise = func.apply(this, arguments);
    } catch (ex) {
      return Promise.reject(ex);
    }
    map.set(id, promise);
    if (forgetOnResolve) {
      promise.then(() => {
        map.delete(id);
      });
    }
    return promise;
  };
}

/**
 * Manages account instance life-cycles, and the TOC of accounts and the
 * per-account folder TOC's.
 */
export class AccountManager {
  constructor({ db, universe, taskRegistry, taskResources }) {
    logic.defineScope(this, "AccountManager");

    this.db = db;
    // We need to tell the DB about us so that it can synchronously lookup
    // accounts and folders for atomicClobbers and atomicDeltas manipulations.
    db.accountManager = this;
    this.universe = universe;
    this.taskRegistry = taskRegistry;
    this.taskResources = taskResources;

    /**
     * Maps account id's to their accountDef instances from the moment we hear
     * about the account.  Necessary since we only tell the accountsTOC about
     * the account once things are sufficiently loaded for the rest of the system
     * to know about the account.
     */
    this._immediateAccountDefsById = new Map();
    this.accountsTOC = new AccountsTOC();

    // prereqify maps. (See the helper function above and its usages below.)
    this._taskTypeLoads = new Map();
    this._accountFoldersTOCLoads = new Map();
    this._accountLoads = new Map();

    /**
     * In the case of initial account creation, there will be an available
     * connection that we can transfer directly to the account when it is created.
     * Account creation calls `stashAccountConnection` on us and we put it in
     * here until we here about the account and create it.
     */
    this._stashedConnectionsByAccountId = new Map();

    /**
     * @type{Map<AccountId, FoldersTOC>}
     * Account FoldersTOCs keyed by accountId for use by methods that need
     * synchronous access.  (Or debugging; it's a hassle to pull things out of
     * the prereqify maps.)
     */
    this.accountFoldersTOCs = new Map();
    /**
     * @type{Map<AccountId, Account>}
     * Accounts keyed by AccountId for use by methods that need synchronous
     * access.  (Or debugging.)
     */
    this.accounts = new Map();

    this.db.on("accounts!tocChange", this._onTOCChange.bind(this));

    /**
     * Ensure the tasks for the given sync engine have been loaded.  In the future
     * this might become the tasks being 'registered' in the case we can cause
     * some of the tasks to only be loaded when they are actually needed.
     */
    this._ensureTasksLoaded = prereqify("_taskTypeLoads", async engineId => {
      const tasks = await engineTaskMappings.get(engineId)();
      this.taskRegistry.registerPerAccountTypeTasks(engineId, tasks);
      return true;
    });

    /**
     * Ensure the folders for the given account have been loaded from disk and the
     * FoldersTOC accordingly initialized.
     */
    this._ensureAccountFoldersTOC = prereqify(
      "_accountFoldersTOCLoads",
      accountId => {
        return this.db.loadFoldersByAccount(accountId).then(folders => {
          // The FoldersTOC wants this so it can mix in per-account data to the
          // folders so they can stand alone without needing to have references and
          // weird cascades in the front-end.
          const accountDef = this.getAccountDefById(accountId);
          const foldersTOC = new FoldersTOC({
            db: this.db,
            accountDef,
            folders,
            dataOverlayManager: this.universe.dataOverlayManager,
          });
          this.accountFoldersTOCs.set(accountId, foldersTOC);
          return foldersTOC;
        });
      },
      true
    );

    /**
     * Ensure the given account has been loaded.
     */
    this._ensureAccount = prereqify(
      "_accountLoads",
      accountId => {
        return this._ensureAccountFoldersTOC(accountId).then(foldersTOC => {
          const accountDef = this.getAccountDefById(accountId);
          return accountModules
            .get(accountDef.type)()
            .then(accountConstructor => {
              const stashedConn = this._stashedConnectionsByAccountId.get(
                accountId
              );
              this._stashedConnectionsByAccountId.delete(accountId);

              const account = new accountConstructor(
                this.universe,
                accountDef,
                foldersTOC,
                this.db,
                stashedConn
              );
              this.accounts.set(accountId, account);
              // If we're online, issue a syncFolderList task.
              if (this.universe.online) {
                this.universe.syncFolderList(accountId, "loadAccount");
              }
              return account;
            });
        });
      },
      true
    );
  }

  /**
   * Initialize ourselves, returning a Promise when we're "sufficiently"
   * initialized.  This means:
   *
   * - The accountsTOC is populated and the accountDefs are known.  This happens
   *   during this call since the MailUniverse gives us this information since
   *   it loaded the account definitions when it loaded its config.
   * - Each account's tasks are loaded and registered with the TaskRegistry.
   *   This is a pre-req to initializing the TaskManager.
   * - Each account's list of folders are loaded and a FolderTOC instantiated
   *   and available for synchronous access.  (In the past, the folders were
   *   stored in a single aggregate object per account and were loaded by the
   *   universe, but we aspire to normalize and decentralize.)
   */
  initFromDB(accountDefs) {
    const waitFor = [];

    for (const accountDef of accountDefs) {
      waitFor.push(this._accountAdded(accountDef));
    }
    return Promise.all(waitFor);
  }

  stashAccountConnection(accountId, conn) {
    this._stashedConnectionsByAccountId.set(accountId, conn);
  }

  acquireAccountsTOC(ctx) {
    return ctx.acquire(this.accountsTOC);
  }

  acquireAccount(ctx, accountId) {
    const account = this.accounts.get(accountId);
    if (account) {
      return ctx.acquire(account);
    }
    return this._ensureAccount(accountId).then(_account => {
      return ctx.acquire(_account);
    });
  }

  acquireAccountFoldersTOC(ctx, accountId) {
    const foldersTOC = this.accountFoldersTOCs.get(accountId);
    if (foldersTOC) {
      return ctx.acquire(foldersTOC);
    }
    return this._ensureAccountFoldersTOC(accountId).then(_foldersTOC => {
      return ctx.acquire(_foldersTOC);
    });
  }

  /**
   * Return the AccountDef for the given AccountId.  This will return accounts
   * we have not acknowledged the existence of to the AccountsTOC yet.
   */
  getAccountDefById(accountId) {
    return this._immediateAccountDefsById.get(accountId);
  }

  /**
   * Return the back-end engine facts for the engine for the given account.  The
   * account is synchronously looked-up without waiting for it to be fully
   * loaded, just like getAccountDefById.
   */
  getAccountEngineBackEndFacts(accountId) {
    const accountDef = this._immediateAccountDefsById.get(accountId);
    return engineBackEndFacts.get(accountDef.engine);
  }

  /**
   * Get all account currently known account definitions *even if we have not
   * completed all the load steps for the accounts*.  Use this if all you need
   * are the accountDefs and there is zero chance of you trying to schedule a
   * task or talk to the account and you are absurdly time sensitive.  Otherwise
   * you really want to be using the accountsTOC and its events.
   *
   * Right now, if you are not the cronsync code trying to call ensureSync() as
   * early as possible in order to avoid worst-case mozAlarm lossages, then you
   * do not meet these requirements.
   *
   * @return {Iterator}
   */
  getAllAccountDefs() {
    return this._immediateAccountDefsById.values();
  }

  getAllAccountIdsWithKind(kind) {
    const ids = [];
    for (const accountDef of this.getAllAccountDefs()) {
      if (!kind || accountDef.kind === kind) {
        ids.push(accountDef.id);
      }
    }
    return ids;
  }

  /**
   * Return the FolderInfo for the given FolderId.  This is only safe to call
   * after the universe has fully loaded.
   */
  getFolderById(folderId) {
    const accountId = accountIdFromFolderId(folderId);
    const foldersTOC = this.accountFoldersTOCs.get(accountId);
    return foldersTOC.foldersById.get(folderId);
  }

  /**
   * Return the an array of ids for the given tag.  This is only safe to call
   * after the universe has fully loaded.
   */
  getFolderIdsByTag(accountId, tag) {
    const foldersTOC = this.accountFoldersTOCs.get(accountId);
    const foldersInfo =
      (tag && foldersTOC.foldersByTag.get(tag)) || foldersTOC.getAllItems();
    return foldersInfo.map(info => info.id);
  }

  /**
   * Our MailDB.on('accounts!tocChange') listener.
   */
  _onTOCChange(accountId, accountDef, isNew) {
    if (isNew) {
      // - Added
      this._accountAdded(accountDef);
    } else if (!accountDef) {
      // - Removed
      this._accountRemoved(accountId);
    } else if (this.accountFoldersTOCs.has(accountId)) {
      // - Changed
      // Skip if we haven't reported the account to the TOC yet.  We can tell
      // by the presence of the foldersTOC.  We don't defer the notification
      // because our object identity rules mean that when the accountDef is
      // reported it will be the most up-to-date representation available.
      this.accountsTOC.__accountModified(accountDef);
    }
  }

  /**
   * When we find out about the existence of an account, ensure that the task
   * definitions are loaded for the account and that we initiate loads of the
   * folders for the account.  The AccountsTOC is only notified about the
   * account after these events have occurred.
   *
   * @returns {Promise}
   *   A promise that's resolved onced our pre-reqs have completed loading and
   *   we have announced the existence of the account via the AccountsTOC.
   */
  _accountAdded(accountDef) {
    logic(this, "accountExists", { accountId: accountDef.id });

    // XXX put these resources into place that we don't actually properly
    // control yet.
    this.taskResources.resourceAvailable(`credentials!${accountDef.id}`);
    this.taskResources.resourceAvailable(`happy!${accountDef.id}`);

    this._immediateAccountDefsById.set(accountDef.id, accountDef);

    const waitFor = [
      this._ensureTasksLoaded(accountDef.engine),
      this._ensureAccountFoldersTOC(accountDef.id),
    ];

    return Promise.all(waitFor).then(() => {
      // If we have a stashed connection, then immediately instantiate the
      // account so that we will also issue a syncFolderList call when an
      // account has just been created.
      //
      // Although this does not seem, nor is it, super clean, we really do not
      // want account_create creating tasks for the freshly created account
      // until after our promises above have run, so this is arguably an okay
      // place to do this.  We probably just want to refactor this out into
      // a more explicit "things to do for freshly created accounts" mechanism.
      // (Maybe a task "account_created" that's per account so the accounts can
      // hang everything they want to do off that.
      if (this._stashedConnectionsByAccountId.has(accountDef.id)) {
        this._ensureAccount(accountDef.id);
      }

      this.accountsTOC.__addAccount(accountDef);
    });
  }

  /**
   * Translate a notification from MailDB that an account has been removed to
   * a call to the AccountsTOC to notify it and clean-up the associated
   * FoldersTOC instance.
   */
  _accountRemoved(accountId) {
    this._immediateAccountDefsById.delete(accountId);

    // - Account cleanup
    // (a helper is needed because a load could be pending)
    const doAccountCleanup = () => {
      const account = this.accounts.get(accountId);
      this.accounts.delete(accountId);
      this._accountLoads.delete(accountId);
      if (account) {
        account.shutdown();
      }
    };

    if (this.accounts.has(accountId)) {
      // We can cleanup immediately if the account is already loaded.
      doAccountCleanup();
    } else if (this._accountLoads.has(accountId)) {
      // If a load is pending, wait for it to finish.
      this._accountLoads.get(accountId).then(doAccountCleanup);
    }

    // - Folder TOCs and Account TOC cleanup
    const doFolderCleanup = () => {
      this.accountFoldersTOCs.delete(accountId);
      this._accountFoldersTOCLoads.delete(accountId);
      // We don't announce the account to the TOC until the folder TOC loaded,
      // so this is the right place to nuke.
      this.accountsTOC.__removeAccountById(accountId);
    };
    if (this.accountFoldersTOCs.has(accountId)) {
      doFolderCleanup();
    } else if (this._accountFoldersTOCLoads.has(accountId)) {
      this._accountFoldersTOCLoads.then(doFolderCleanup);
    }
  }
}
