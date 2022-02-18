/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

const { SessionManager } = ChromeUtils.import(
  "resource:///modules/SessionManager.jsm"
);

const TEST_URL = "https://example.com/";
const POPUP_URL = "https://example.com/browser/";

let win;

add_setup(async () => {
  // Run tests in a new window to avoid affecting the main test window.
  win = await BrowserTestUtils.openNewBrowserWindow();

  registerCleanupFunction(async () => {
    await promiseWindowClosedAndSessionSaved(win);
  });
});

add_task(async function test_popup_ignored_on_close() {
  BrowserTestUtils.loadURI(win.gBrowser.selectedBrowser, TEST_URL);
  await BrowserTestUtils.browserLoaded(
    win.gBrowser.selectedBrowser,
    false,
    TEST_URL
  );

  let onPopupOpened = BrowserTestUtils.waitForNewWindow({ url: POPUP_URL });
  await SpecialPowers.spawn(
    gBrowser.selectedBrowser,
    [POPUP_URL],
    async url => {
      content.window.open(
        url,
        "_blank",
        "dialog,centerscreen,width=300,height=250"
      );
    }
  );

  let popup = await onPopupOpened;

  let sessionGuid = SessionStore.getCustomWindowValue(
    win,
    "SessionManagerGuid"
  );
  Assert.ok(sessionGuid, "Should have an active session");

  let popupGuid = SessionStore.getCustomWindowValue(
    popup,
    "SessionManagerGuid"
  );
  Assert.equal(popupGuid, "", "Popup should not have a sessionManager guid");

  popup.close();

  let sessions = await SessionManager.query({
    guid: sessionGuid,
    includePages: true,
  });
  Assert.equal(
    sessions[0].pages.length,
    0,
    "There should be no pages in the session"
  );
});

add_task(async function test_popup_ignored_on_setaside() {
  BrowserTestUtils.loadURI(win.gBrowser.selectedBrowser, TEST_URL);
  await BrowserTestUtils.browserLoaded(
    win.gBrowser.selectedBrowser,
    false,
    TEST_URL
  );

  let onPopupOpened = BrowserTestUtils.waitForNewWindow({ url: POPUP_URL });
  await SpecialPowers.spawn(
    gBrowser.selectedBrowser,
    [POPUP_URL],
    async url => {
      content.window.open(
        url,
        "_blank",
        "dialog,centerscreen,width=300,height=250"
      );
    }
  );

  let popup = await onPopupOpened;

  let sessionGuid = SessionStore.getCustomWindowValue(
    win,
    "SessionManagerGuid"
  );
  Assert.ok(sessionGuid, "Should have an active session");

  let changeComplete = SessionManager.once("sessions-updated");
  win.document.getElementById("session-setaside-button").click();
  await changeComplete;

  let sessions = await SessionManager.query({
    guid: sessionGuid,
    includePages: true,
  });
  Assert.deepEqual(
    sessions[0].pages,
    [{ url: TEST_URL, position: 0 }],
    "Only the main content window should be in the session"
  );

  let popupGuid = SessionStore.getCustomWindowValue(
    popup,
    "SessionManagerGuid"
  );
  Assert.equal(popupGuid, "", "Popup should not have a sessionManager guid");

  popup.close();
  sessions = await SessionManager.query({
    guid: sessionGuid,
    includePages: true,
  });
  Assert.deepEqual(
    sessions[0].pages,
    [{ url: TEST_URL, position: 0 }],
    "Only the main content window should be in the session after popup close"
  );
});
