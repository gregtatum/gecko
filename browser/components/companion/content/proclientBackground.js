/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

function ensureWindowInvisible() {
  let baseWin = window.docShell.treeOwner.QueryInterface(Ci.nsIBaseWindow);
  baseWin.visibility = false;
}

let gMenu = null;
let gStatusBar = null;
const gMenuItems = [
  { id: "proclientBackground-newWindow", command: openWindow },
  { id: "proclientBackground-exitApplication", command: exitApplication },
];

addEventListener("load", async () => {
  gStatusBar = Cc["@mozilla.org/widget/systemstatusbar;1"].getService(
    Ci.nsISystemStatusBar
  );
  gMenu = document.getElementById(`proclientBackground-menu`);
  gStatusBar.addItem(gMenu);

  // This window just exists to be a host to the status bar menu - we don't want
  // to show it.
  ensureWindowInvisible();
});

addEventListener("unload", () => {
  gStatusBar.removeItem(gMenu);
});

function openWindow() {
  let browserWindow = Services.wm.getMostRecentWindow("navigator:browser");
  if (browserWindow) {
    browserWindow.OpenBrowserWindow();
  } else {
    const { openBrowserWindow } = ChromeUtils.import(
      "resource:///modules/BrowserContentHandler.jsm"
    );
    openBrowserWindow();
  }
}

async function exitApplication() {
  let browserWindow = Services.wm.getMostRecentWindow("navigator:browser");
  if (browserWindow && browserWindow.gBrowserInit) {
    await browserWindow.gBrowserInit.idleTasksFinishedPromise;
  }
  Services.startup.quit(Ci.nsIAppStartup.eForceQuit);
}

window.addEventListener("popupshowing", event => {
  // When we get the popupshowing event from the nsISystemStatusBar service, it
  // automatically shows the window, so we undo that here.
  ensureWindowInvisible();
  const menupopup = event.target;
  if (menupopup._initialized) {
    return;
  }

  for (let item of gMenuItems) {
    let menuitem = menupopup.ownerDocument.getElementById(item.id);
    menuitem.addEventListener("command", item.command);
  }
  menupopup._initialied = true;
});
