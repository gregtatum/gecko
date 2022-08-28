/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Test for session manager saving errors management.
 */

let errors = [
  {
    stub: sandbox => {
      sandbox
        .stub(PlacesUtils, "withConnectionWrapper")
        .rejects(
          new Components.Exception("Error", Cr.NS_ERROR_FILE_ACCESS_DENIED)
        );
    },
    type: "DatabaseAccessDenied",
  },
  {
    stub: sandbox => {
      sandbox
        .stub(PlacesUtils, "withConnectionWrapper")
        .rejects(new Components.Exception("Error", Cr.NS_ERROR_ABORT));
    },
    type: "Abort",
  },
  {
    stub: sandbox => {
      sandbox
        .stub(PlacesUtils, "withConnectionWrapper")
        .rejects(
          new Components.Exception("Error", Cr.NS_ERROR_FILE_NO_DEVICE_SPACE)
        );
    },
    type: "NoSpaceLeftOnDevice",
  },
  {
    stub: sandbox => {
      sandbox
        .stub(PlacesUtils, "withConnectionWrapper")
        .rejects(new Components.Exception("Error", Cr.NS_ERROR_OUT_OF_MEMORY));
    },
    type: "OutOfMemory",
  },
  {
    stub: sandbox => {
      sandbox
        .stub(PlacesUtils, "withConnectionWrapper")
        .rejects(new Components.Exception("Error", Cr.NS_ERROR_FILE_CORRUPTED));
    },
    type: "CorruptDatabase",
  },
  {
    stub: sandbox => {
      let err = new Error("Target device is full");
      err.name = "NotReadableError";
      sandbox.stub(SessionManager, "write").rejects(err);
    },
    type: "NoSpaceLeftOnDevice",
  },
  {
    stub: sandbox => {
      let err = new Error();
      err.name = "InvalidAccessError";
      sandbox.stub(SessionManager, "write").rejects(err);
    },
    type: "InvalidSessionFilePath",
  },
  {
    stub: sandbox => {
      let err = new Error();
      sandbox.stub(SessionManager, "write").rejects(err);
    },
    type: "SessionFileAccessDenied",
  },
];

add_task(async function test_errors() {
  const TEST_URL = "https://example.com/";
  let now = Date.now();
  // Run tests in a new window to avoid affecting the main test window.
  let win = await BrowserTestUtils.openNewBrowserWindow();
  registerCleanupFunction(async () => {
    await promiseWindowClosedAndSessionSaved(win);
  });

  BrowserTestUtils.loadURI(win.gBrowser.selectedBrowser, TEST_URL);
  await BrowserTestUtils.browserLoaded(
    win.gBrowser.selectedBrowser,
    false,
    TEST_URL
  );

  let sessionGuid = SessionStore.getCustomWindowValue(
    win,
    "SessionManagerGuid"
  );
  Assert.ok(sessionGuid, "Should have an active session");

  await assertSessionData({
    guid: sessionGuid,
    lastSavedAt: now,
    data: {},
  });

  // Force errors temporarily for this test.

  const sandbox = sinon.createSandbox();
  for (let error of errors) {
    error.stub(sandbox);
    let errorNotification = SessionManager.once("session-save-error");
    try {
      await SessionManager.replaceSession(win);
    } catch (ex) {
      // Ignore error.
    }
    info("Awaiting the event");
    let err = await errorNotification;
    Assert.equal(err.type, error.type, "Error should have the expected type");
    sandbox.restore();
  }
});
