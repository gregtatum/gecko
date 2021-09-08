/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Basic session registration, set aside and restore tests.
 */

const TEST_URL = "https://example.com/";
const TEST_URL2 = "https://example.com/browser/";

let win;
let dateCheckpoint;

add_task(async function setup() {
  // Run tests in a new window to avoid affecting the main test window.
  win = await BrowserTestUtils.openNewBrowserWindow();

  registerCleanupFunction(async () => {
    await BrowserTestUtils.closeWindow(win);
  });
});

add_task(async function test_register_session() {
  dateCheckpoint = Date.now();
  Assert.ok(
    !SessionStore.getCustomWindowValue(win, "SessionManagerGuid"),
    "Should not have an active session"
  );

  BrowserTestUtils.loadURI(win.gBrowser.selectedBrowser, TEST_URL);
  await BrowserTestUtils.browserLoaded(
    win.gBrowser.selectedBrowser,
    false,
    TEST_URL
  );

  let guid = SessionStore.getCustomWindowValue(win, "SessionManagerGuid");
  Assert.ok(guid, "Should have an active session");

  await assertSessionData({
    guid,
    lastSavedAt: dateCheckpoint,
    data: {},
  });
});
