/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Tests for waiting for beforeunload before replacing a session.
 */

const { PromptTestUtils } = ChromeUtils.import(
  "resource://testing-common/PromptTestUtils.jsm"
);

// The first two urls are intentionally different domains to force pages
// to load in different tabs.
const TEST_PATH = getRootDirectory(gTestPath).replace(
  "chrome://mochitests/content",
  "https://example.com"
);
const TEST_URL = "https://example.com/";

const BUILDER_URL = "https://example.com/document-builder.sjs?html=";
const PAGE_MARKUP = `
<html>
<head>
  <script>
    window.onbeforeunload = function() {
      return true;
    };
  </script>
</head>
<body>TEST PAGE</body>
</html>
`;
const TEST_URL2 = BUILDER_URL + encodeURI(PAGE_MARKUP);

let win;
let changeStartReceived = 0;

function listener() {
  changeStartReceived++;
}

add_task(async function setup() {
  await SpecialPowers.pushPrefEnv({
    set: [["dom.require_user_interaction_for_beforeunload", false]],
  });

  // Run tests in a new window to avoid affecting the main test window.
  win = await BrowserTestUtils.openNewBrowserWindow();

  BrowserTestUtils.loadURI(win.gBrowser.selectedBrowser, TEST_URL);
  await BrowserTestUtils.browserLoaded(
    win.gBrowser.selectedBrowser,
    false,
    TEST_URL
  );
  await BrowserTestUtils.openNewForegroundTab(win.gBrowser, TEST_URL2);

  SessionManager.on("session-change-start", listener);

  registerCleanupFunction(async () => {
    await promiseWindowClosedAndSessionSaved(win);
    SessionManager.off("session-change-start", listener);
  });
});

add_task(async function test_set_aside_unload_cancelled() {
  let unloadDialogPromise = PromptTestUtils.handleNextPrompt(
    win,
    {
      modalType: Ci.nsIPrompt.MODAL_TYPE_CONTENT,
      promptType: "confirmEx",
    },
    // Click the cancel.
    { buttonNumClick: 1 },
    () => {
      Assert.equal(
        changeStartReceived,
        0,
        "Should not have received a session start"
      );
      Assert.equal(
        win.gBrowser.tabs.length,
        2,
        "Should still have all tabs open"
      );
    }
  );

  win.document.getElementById("session-setaside-button").click();

  await unloadDialogPromise;

  Assert.equal(win.gBrowser.tabs.length, 2, "Should still have all tabs open");
  Assert.equal(
    changeStartReceived,
    0,
    "Should not have received a session start"
  );
});

add_task(async function test_set_aside_unload_accepted() {
  let sessionGuid = SessionStore.getCustomWindowValue(
    win,
    "SessionManagerGuid"
  );
  Assert.ok(sessionGuid, "Should have an active session");

  let unloadDialogPromise = PromptTestUtils.handleNextPrompt(
    win,
    {
      modalType: Ci.nsIPrompt.MODAL_TYPE_CONTENT,
      promptType: "confirmEx",
    },
    // Click the ok button.
    { buttonNumClick: 0 },
    () => {
      Assert.equal(
        changeStartReceived,
        0,
        "Should not have received a session start"
      );
      Assert.equal(
        win.gBrowser.tabs.length,
        2,
        "Should still have all tabs open"
      );
    }
  );

  let changeComplete = SessionManager.once("session-replaced", listener);
  win.document.getElementById("session-setaside-button").click();

  await unloadDialogPromise;

  Assert.equal(changeStartReceived, 1, "Should have received a session start");

  await changeComplete;

  Assert.equal(
    win.gBrowser.tabs.length,
    1,
    "Should still have closed tabs with about:blank remaining"
  );
  sessionGuid = SessionStore.getCustomWindowValue(win, "SessionManagerGuid");
  Assert.ok(!sessionGuid, "Should not have an active session");
});
