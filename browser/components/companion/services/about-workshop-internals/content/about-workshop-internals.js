/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import workshopAPI from "chrome://browser/content/companion/workshop-api-built.js";

import HomePage from "./pages/home.js";
import AccountFolderListPage from "./pages/account_folder_list.js";
import AccountFolderMessageContentsPage from "./pages/account_folder_message_contents.js";

import { HackyHashRouter } from "./router.js";

const parseId = s => s;

window.ROUTER = new HackyHashRouter({
  workshopAPI,
  root: {
    pageConstructor: HomePage,
    children: {
      account: {
        pageConstructor: AccountFolderListPage,
        valueName: "accountId",
        valueParser: parseId,
        children: {
          folder: {
            pageConstructor: AccountFolderMessageContentsPage,
            valueName: "folderId",
            valueParser: parseId,
          },
        },
      },
    },
  },
});

window.ROUTER.updateFromHash();
