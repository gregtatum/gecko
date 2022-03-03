/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

const { SessionManager } = ChromeUtils.import(
  "resource:///modules/SessionManager.jsm"
);

const SESSIONSTORE_STATE_KEY = "GlobalHistoryState";

/**
 * Tests that session restoration still works when the workspaceId wasn't
 * included in the state object persisted to disk. This can happen when
 * restoring sessions from older builds before workspaceId was added.
 */
add_task(async function test_missing_workspace() {
  // Run test in a new window to avoid affecting the main test window.
  let win = await BrowserTestUtils.openNewBrowserWindow();

  registerCleanupFunction(async () => {
    await BrowserTestUtils.closeWindow(win);
  });

  const PAGE_URLS = [
    "https://example.com/",
    "https://example.com/browser/browser",
    "https://example.org/browser",
    "https://example.org/browser/browser/components",
  ];

  await PinebuildTestUtils.loadViews(PAGE_URLS, win);

  let state = JSON.parse(
    SessionStore.getCustomWindowValue(win, SESSIONSTORE_STATE_KEY)
  );

  // Manually delete the workspace property to simulate an older
  // session from before the workspace property was added.
  for (let stateItem of state) {
    delete stateItem.workspaceId;
  }

  SessionStore.setCustomWindowValue(
    win,
    SESSIONSTORE_STATE_KEY,
    JSON.stringify(state)
  );

  let sessionSetAside = SessionManager.once("session-set-aside");
  let sessionReplaced = SessionManager.once("session-replaced");
  let flowResetLoaded = BrowserTestUtils.waitForNewTab(
    win.gBrowser,
    "about:flow-reset",
    true
  );
  win.document.getElementById("session-setaside-button").click();
  await sessionSetAside;
  await sessionReplaced;
  await flowResetLoaded;

  sessionReplaced = SessionManager.once("session-replaced");
  await SessionManager.restoreLastSession(win);
  await sessionReplaced;

  PinebuildTestUtils.assertUrlsAre(PAGE_URLS, win);
});
