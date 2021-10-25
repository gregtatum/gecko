/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Tests for replacing a session and checking the size and position are unchanged.
 */

const TEST_URL = "https://example.org/";

let win;
let sessionGuid;

function getWindowSize(w) {
  return {
    screenY: w.screenY,
    screenX: w.screenX,
    width: w.outerWidth,
    height: w.outerHeight,
  };
}

add_task(async function setup() {
  // Run tests in a new window to avoid affecting the main test window.
  win = await BrowserTestUtils.openNewBrowserWindow();

  registerCleanupFunction(async () => {
    await promiseWindowClosedAndSessionSaved(win);
  });
});

add_task(async function test_replaceSession_window_size_unchanged() {
  sessionGuid = await testSetAsideSession(
    win,
    async () => {
      BrowserTestUtils.loadURI(win.gBrowser.selectedBrowser, TEST_URL);
      await BrowserTestUtils.browserLoaded(
        win.gBrowser.selectedBrowser,
        false,
        TEST_URL
      );
    },
    [{ url: TEST_URL, position: 0 }]
  );

  win.resizeBy(-100, -100);
  win.moveBy(100, 100);

  let sizes = getWindowSize(win);

  await testReplaceSession(win, sessionGuid, {
    tabs: [[TEST_URL]],
    index: 0,
  });

  Assert.deepEqual(
    getWindowSize(win),
    sizes,
    "Should have not changed the window size and position on restore."
  );
});

add_task(async function test_replaceSession_window_size_mode() {
  // Set aside the current session again.
  let changeComplete = SessionManager.once("session-replaced");
  win.document.getElementById("session-setaside-button").click();
  await changeComplete;

  win.maximize();

  let sizeMode = win.windowState;

  await testReplaceSession(win, sessionGuid, {
    tabs: [[TEST_URL]],
    index: 0,
  });

  Assert.deepEqual(
    win.windowState,
    sizeMode,
    "Should not have changed the window size mode on restore."
  );
});
