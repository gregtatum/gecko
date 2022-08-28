/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/
 */

"use strict";

const { TelemetryTestUtils } = ChromeUtils.import(
  "resource://testing-common/TelemetryTestUtils.jsm"
);

add_setup(async () => {
  Services.telemetry.setEventRecordingEnabled("pinebuild", true);
  registerCleanupFunction(async () => {
    Services.telemetry.setEventRecordingEnabled("pinebuild", false);
  });
});

const setup = () => {
  Services.telemetry.clearScalars();
  Services.fog.testResetFOG();
};

/*
 * Verifies that Glean and Telemetry scalars are incremented when the session
 * set aside button is clicked.
 */
add_task(async function test_countSetAsideButtonClicks() {
  setup();

  // Go to a page other than the flow-reset page, so that the toolbar is shown.
  let win = await BrowserTestUtils.openNewBrowserWindow();
  let browser = win.gBrowser.selectedBrowser;
  BrowserTestUtils.loadURI(browser, "https://test1.example.com/");
  await BrowserTestUtils.browserLoaded(browser);
  await BrowserTestUtils.waitForCondition(
    () => !win.document.body.hasAttribute("flow-reset"),
    "Wait for the browser to exit flow reset mode"
  );

  Assert.equal(
    undefined,
    Glean.pinebuild.setAsideClickCount.testGetValue(),
    "The Glean scalar should be unset"
  );
  TelemetryTestUtils.assertScalarUnset(
    TelemetryTestUtils.getProcessScalars("parent"),
    "pinebuild.set_aside_click_count"
  );

  const setAsideButton = win.document.querySelector("#session-setaside-button");
  await BrowserTestUtils.waitForCondition(
    () => !setAsideButton.disabled,
    "Ensure the set aside button is enabled before trying to click it"
  );
  setAsideButton.dispatchEvent(new MouseEvent("click"));
  await BrowserTestUtils.waitForCondition(
    () => win.document.body.hasAttribute("flow-reset"),
    "Wait for the browser to re-enter flow reset mode"
  );

  // Eagerly close the window, to flush queued probes.
  await BrowserTestUtils.closeWindow(win);

  Assert.equal(
    1,
    Glean.pinebuild.setAsideClickCount.testGetValue(),
    "The Glean click count should match the expected value"
  );
  TelemetryTestUtils.assertScalar(
    TelemetryTestUtils.getProcessScalars("parent"),
    "pinebuild.set_aside_click_count",
    1,
    "The Telemetry click count should match the expected value"
  );
});
