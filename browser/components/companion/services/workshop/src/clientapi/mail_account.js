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

import { Emitter } from "evt";
import { MailSenderIdentity } from "./mail_sender_identity";

/**
 *
 */
export class MailAccount extends Emitter {
  constructor(api, wireRep, overlays, matchInfo, acctsSlice) {
    super();
    this._api = api;
    this.id = wireRep.id;
    this.matchInfo = matchInfo;

    // Hold on to wireRep for caching
    this._wireRep = wireRep;

    // Hold on to acctsSlice for use in determining default account.
    this.acctsSlice = acctsSlice;

    this.type = wireRep.type;
    this.name = wireRep.name;
    this.kind = wireRep.kind || "";
    this.syncRange = wireRep.syncRange;
    this.syncInterval = wireRep.syncInterval;
    this.notifyOnNew = wireRep.notifyOnNew;
    this.playSoundOnSend = wireRep.playSoundOnSend;

    /**
     * Is the account currently enabled, as in will we talk to the server?
     * Accounts will be automatically disabled in cases where it would be
     * counter-productive for us to keep trying to access the server.
     *
     * For example: the user's password being (apparently) bad, or gmail getting
     * upset about the amount of data transfer and locking the account out for the
     * rest of the day.
     */
    this.enabled = wireRep.enabled;

    /**
     * Problems are an object where keys are the type of the problems and
     * values are an array of error messages.
     * For example it could be:
     * {
     *   credentials: ["Required authentication ..."],
     *   permissions: ["Access is denied..."]
     * }
     * The different possible meesages and type of issues are describe can be
     * found in the account definition (e.g. backend/accounts/mapi/account.js).
     */
    this.problems = wireRep.problems;

    this.identities = wireRep.identities.map(
      id => new MailSenderIdentity(this._api, id)
    );

    this.username = wireRep.credentials.username;
    this.servers = wireRep.servers;

    this.authMechanism = wireRep.credentials.oauth2 ? "oauth2" : "password";

    this.folders = null;
    if (acctsSlice && acctsSlice._autoViewFolders) {
      this.folders = api.viewFolders("account", this.id);
    }

    this.__updateOverlays(overlays);
  }

  toString() {
    return "[MailAccount: " + this.type + " " + this.id + "]";
  }

  toJSON() {
    return {
      type: "MailAccount",
      accountType: this.type,
      id: this.id,
    };
  }

  __update(wireRep) {
    const prevProblems = this.problems;
    this._wireRep = wireRep;
    this.enabled = wireRep.enabled;
    this.problems = wireRep.problems;
    this.syncRange = wireRep.syncRange;
    this.syncInterval = wireRep.syncInterval;
    this.notifyOnNew = wireRep.notifyOnNew;
    this.playSoundOnSend = wireRep.playSoundOnSend;

    for (let i = 0; i < wireRep.identities.length; i++) {
      if (this.identities[i]) {
        this.identities[i].__update(wireRep.identities[i]);
      } else {
        this.identities.push(
          new MailSenderIdentity(this._api, wireRep.identities[i])
        );
      }
    }

    let hasNewProblems = false;
    if (prevProblems && this.problems) {
      const prevValues = prevProblems.values().flat();
      const newValues = this.problems.values().flat();
      if (prevValues.length !== newValues.length) {
        hasNewProblems = true;
      } else {
        prevValues.sort();
        newValues.sort();
        hasNewProblems = prevValues.some((x, i) => x !== newValues[i]);
      }
    } else {
      hasNewProblems = prevProblems !== this.problems;
    }
    if (hasNewProblems) {
      this.emit("problems", this.problems);
    }
  }

  __updateOverlays(overlays) {
    this.syncStatus = overlays.sync_refresh ? overlays.sync_refresh : null;
  }

  release() {
    // currently, nothing to clean up
  }

  /**
   * Tell the back-end to clear the list of problems with the account, re-enable
   * it, and try and connect.
   */
  clearProblems(callback) {
    this._api._clearAccountProblems(this, callback);
  }

  /**
   * @param {Object} mods
   *   Modify properties on the account.
   *
   *   In addition to regular account property settings,
   *   "setAsDefault": true can be passed to set this account as the
   *   default acccount.
   *
   *   # Username and Password Setting
   *
   *   If you want to modify the username or password of an account,
   *   keep in mind that IMAP/POP3 accounts might have two separate
   *   passwords, one for incoming mail and one for SMTP. You have a
   *   couple options:
   *
   *   - If you specify "username" and/or "password", we'll change the
   *     incoming side, and if the SMTP side had the same
   *     username/password, we'll change that too.
   *
   *   - If you specify incomingUsername, incomingPassword, etc., we
   *     will NOT do that magic inferring; we'll just change the side
   *     you specify.
   *
   *   Practically speaking, most accounts will likely share the same
   *   username and password. Additionally, if we guess that the
   *   passwords/usernames should match when they actually should
   *   differ, we'll safely recover becuase we'll then ask for a
   *   corrected SMTP password.
   * @param {String} [mods.password]
   * @param {String} [mods.incomingPassword]
   * @param {String} [mods.outgoingPassword]
   * @param {String} [mods.username]
   * @param {String} [mods.incomingUsername]
   * @param {String} [mods.outgoingUsername]
   * @param {Boolean} [mods.setAsDefault]
   * @param {Object} [mods.oauthTokens]
   * @param {String} [mods.oauthTokens.accessToken]
   * @param {String} [mods.oauthTokens.refreshToken]
   * @param {number} [mods.oauthTokens.tokenExpires]
   *
   * @return {Promise}
   *   A promise that is resolved when the back-end has applied the changes to
   *   the account and propagated them.
   */
  modifyAccount(mods) {
    return this._api._modifyAccount(this, mods);
  }

  modifyFolder(mods) {
    return this._api._modifyFolder(this, mods);
  }

  /**
   * Delete the account and then immediate re-create it as if we had performed
   * a lazy config migration.  This is intended mainly for debugging and
   * development scenarios where one wants to use the same account but start
   * from scratch without typing things all over again.
   */
  recreateAccount() {
    return this._api._recreateAccount(this);
  }

  /**
   * Delete the account and all its associated data.  No privacy guarantees are
   * provided; we just delete the data from the database, so it's up to the
   * (IndexedDB) database's guarantees on that.
   */
  deleteAccount() {
    return this._api._deleteAccount(this);
  }

  /**
   * Synchronize the folder list for this account.  While this method is async
   * and you can await it, you don't have to; the contents of the `folders`
   * list view will automatically update.  This is handy for testing, though.
   */
  async syncFolderList() {
    await this._api._sendPromisedRequest({
      type: "syncFolderList",
      accountId: this.id,
    });
  }

  /**
   * Once the account has been created and the folder list created, this method
   * can be used in order to feed the folders with the events of the day.
   * It allows to fastly have something to view in the companion bar.
   */
  async fillEmptyAccount() {
    await this._api._sendPromisedRequest({
      type: "fillEmptyAccount",
      accountId: this.id,
    });
  }

  /**
   * Clear the new-tracking state for this account.  Also accessible as
   * `MailAPI.clearNewTrackingForAccount`.
   */
  clearNewTracking(opts) {
    this._api.clearNewTrackingForAccount({
      accountId: this.id,
      silent: (opts && opts.silent) || false,
    });
  }

  /**
   * Returns true if this account is the default account, by looking at
   * all accounts in the acctsSlice.
   */
  get isDefault() {
    if (!this.acctsSlice) {
      throw new Error("No account slice available");
    }

    return this.acctsSlice.defaultAccount === this;
  }
}
