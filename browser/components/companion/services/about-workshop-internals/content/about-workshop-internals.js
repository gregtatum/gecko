/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

window.onunhandledrejection = event => {
  console.warn("UNHANDLED PROMISE REJECTION", event.reason);
};

import workshopAPI from "./workshop_glue.js";
window.WORKSHOP_API = workshopAPI;

import AccountFolderListPage from "./pages/account_folder_list.js";
import AccountFolderMessageContentsPage from "./pages/account_folder_message_contents.js";
import AddAccountPage from "./pages/add_account.js";
import HomePage from "./pages/home.js";
import LogsPage from "./pages/logs.js";
import SettingsPage from "./pages/settings.js";

import { HackyHashRouter } from "./router.js";

// Ensure that we're listening for logs as soon as we're opened by importing for
// side-effect.  In the future we may instead just have the backend buffer logs
// and instead ask it for the logs when we open the page.  Primary factors will
// be:
// - Supporting after-the-fact log gathering for user-supported debugging.
//   (This previously was handled by the backend.)
// - Are we losing logs when trying to explicitly use the about UI?
import "./log_collected.js";

const parseId = s => s;

window.ROUTER = new HackyHashRouter({
  workshopAPI,
  root: {
    pageConstructor: HomePage,
    makeLabel: () => "Home",
    children: {
      account: {
        pageConstructor: AccountFolderListPage,
        valueName: "accountId",
        valueParser: parseId,
        makeLabel: async accountId => {
          const account = await workshopAPI.eventuallyGetAccountById(accountId);
          return `Account: ${account.name}`;
        },
        children: {
          folder: {
            pageConstructor: AccountFolderMessageContentsPage,
            valueName: "folderId",
            valueParser: parseId,
            makeLabel: async folderId => {
              const folder = await workshopAPI.eventuallyGetFolderById(
                folderId
              );
              return `Folder: ${folder.name}`;
            },
          },
        },
      },
      add: {
        pageConstructor: AddAccountPage,
        makeLabel: () => "Add Account",
      },
      logs: {
        pageConstructor: LogsPage,
        makeLabel: () => "Logs",
      },
      settings: {
        pageConstructor: SettingsPage,
        makeLabel: () => "Settings",
      },
    },
  },
});

window.ROUTER.updateFromHash();
window.onunhandledrejection = event => {
  console.warn("UNHANDLED PROMISE REJECTION", event.reason);
};
