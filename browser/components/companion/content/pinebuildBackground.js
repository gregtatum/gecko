/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// On Mac, we get included from the hidden window, which means we already
// have Services defined, so we can't import in the usual const { Services }
// way.
var Services = ChromeUtils.import("resource://gre/modules/Services.jsm")
  .Services;

import { initNotifications } from "./notifications.js";

function pinebuildBackground() {
  if (
    !Services.prefs.getBoolPref("browser.startup.launchOnOSLogin", false) &&
    !Services.prefs.getBoolPref(
      "browser.startup.launchOnOSLogin.enabledForTesting",
      false
    )
  ) {
    return;
  }

  function ensureWindowInvisible() {
    let baseWin = window.docShell.treeOwner.QueryInterface(Ci.nsIBaseWindow);
    baseWin.visibility = false;
  }

  let gMenu = null;
  let gStatusBar = null;
  const gMenuItems = [
    { id: "pinebuildBackground-newWindow", command: openWindow },
    { id: "pinebuildBackground-exitApplication", command: exitApplication },
  ];

  addEventListener("load", async () => {
    gStatusBar = Cc["@mozilla.org/widget/systemstatusbar;1"].getService(
      Ci.nsISystemStatusBar
    );
    gMenu = document.getElementById(`pinebuildBackground-menu`);
    gStatusBar.addItem(gMenu);

    // This window just exists to be a host to the status bar menu - we don't want
    // to show it.
    ensureWindowInvisible();
  });

  addEventListener("unload", () => {
    gStatusBar.removeItem(gMenu);
  });

  function openWindow() {
    if ("OpenBrowserWindow" in window) {
      window.OpenBrowserWindow();
      return;
    }
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

  function openOrFocusWindow() {
    let browserWindow = Services.wm.getMostRecentWindow("navigator:browser");
    if (browserWindow) {
      browserWindow.focus();
    } else {
      openWindow();
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

  window.addEventListener("systemstatusbarclick", event => {
    ensureWindowInvisible();
    openOrFocusWindow();
  });

  // If we ever switch to loading this file every time on Windows, we can
  // remove the corresponding code in companion.js.
  initNotifications();
}

pinebuildBackground();
