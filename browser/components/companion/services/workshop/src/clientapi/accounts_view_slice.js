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

import EntireListView from "./entire_list_view";
import MailAccount from "./mail_account";

export default function AccountsViewSlice(api, handle, opts) {
  EntireListView.call(this, api, MailAccount, handle);

  this._autoViewFolders = (opts && opts.autoViewFolders) || false;
}
AccountsViewSlice.prototype = Object.create(EntireListView.prototype);

/**
 * Return the account with the given ID, or null.
 */
AccountsViewSlice.prototype.getAccountById = function(id) {
  for (var i = 0; i < this.items.length; i++) {
    if (this.items[i].id === id) {
      return this.items[i];
    }
  }
  return null;
};

/**
 * Return a promise that's resolved with the account with the given account id
 * when it shows up.  This used to also reject if the account failed to show up,
 * but it turned out that the emergent 'complete' semantics got rather complex
 * and, well, I'm copping out here.  Just don't ask for invalid account id's,
 * okay?
 * XXX generate unambiguous/correct rejections
 */
AccountsViewSlice.prototype.eventuallyGetAccountById = function(id) {
  return new Promise((resolve, reject) => {
    const existingAccount = this.getAccountById(id);
    if (existingAccount) {
      resolve(existingAccount);
      return;
    }

    let addListener = account => {
      if (account.id === id) {
        this.removeListener("add", addListener);
        resolve(account);
      }
    };
    this.on("add", addListener);
  });
};

Object.defineProperty(AccountsViewSlice.prototype, "defaultAccount", {
  get() {
    var defaultAccount = this.items[0];
    for (var i = 1; i < this.items.length; i++) {
      // For UI upgrades, the defaultPriority may not be set, so default to
      // zero for comparisons
      if (
        (this.items[i]._wireRep.defaultPriority || 0) >
        (defaultAccount._wireRep.defaultPriority || 0)
      ) {
        defaultAccount = this.items[i];
      }
    }

    return defaultAccount;
  },
});
