/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Main thread services used by the backend.
const OnlineServicesHelper = ChromeUtils.import(
  "resource:///modules/OnlineServicesHelper.jsm"
);

window.onunhandledrejection = event => {
  console.warn("UNHANDLED PROMISE REJECTION", event.reason);
};

import { MailAPIFactory } from "./workshop_glue.js";
const workshopAPI = (window.WORKSHOP_API = MailAPIFactory(
  OnlineServicesHelper
));

const unloadListener = evt => {
  window.removeEventListener("beforeunload", unloadListener);
  // We're unloading and maybe a main thread service is using
  // the port associated with the workshopAPI.
  workshopAPI.willDie();
};
window.addEventListener("beforeunload", unloadListener);

import AccountFolderListPage from "./pages/account_folder_list.js";
import AccountFolderMessageContentsPage from "./pages/account_folder_message_contents.js";
import AccountMessageContentsByTagPage from "./pages/account_message_contents_by_tag.js";
import AddAccountPage from "./pages/add_account.js";
import AllMessageContentsByTagPage from "./pages/all_message_contents_by_tag.js";
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
          tag: {
            pageConstructor: AccountMessageContentsByTagPage,
            valueName: "accountId",
            valueParser: parseId,
            makeLabel: async accountId => {
              const account = await workshopAPI.eventuallyGetAccountById(
                accountId
              );
              return `Account: ${account.name}`;
            },
          },
          "tag-all": {
            pageConstructor: AllMessageContentsByTagPage,
            makeLabel: () => "All Messages",
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
