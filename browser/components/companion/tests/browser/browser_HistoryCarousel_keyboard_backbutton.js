/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";
/**
 * tgiles: this test file exists because trying to run the
 * test_back_button_doesnt_lose_focus_on_tab_restore task in the other
 * file causes this test to time out and I have no idea why.
 */

/**
 * Ensures that the back button does not lose focus when activating the button via keyboard.
 * Previously, focus could be stolen from the back button on tab restore, which can occur after
 * restoring a session. (MR2-1608)
 */
add_task(async function test_back_button_doesnt_lose_focus_on_tab_restore() {
  // Open a new browser window so that the prevent tasks don't impact this task
  // let win = await BrowserTestUtils.openNewBrowserWindow();
  // let { gBrowser, gStageManager, SessionManager } = win;
  let win = window;
  // Prevent megaback from appearing since we send many keypresses on the back button.
  await SpecialPowers.pushPrefEnv({
    set: [["browser.pinebuild.megaback.click-count-threshold", 10000]],
  });
  await PinebuildTestUtils.loadViews(
    [
      "https://example.com/",
      "https://example.com/browser/browser",
      "https://example.org/browser",
      "https://example.org/browser/browser/components",
    ],
    win
  );
  // Make sure focus does not leave back button when using
  // the Enter key and the Space bar.
  let keyChars = ["KEY_Enter", " "];
  for (let keyChar of keyChars) {
    // Set aside session so that we can restore the session
    // and ensure focus does not leave the back button.
    let sessionSetAside = SessionManager.once("session-set-aside");
    let sessionReplaced = SessionManager.once("session-replaced");
    let flowResetLoaded = BrowserTestUtils.waitForNewTab(
      gBrowser,
      "about:flow-reset",
      true
    );

    win.document.getElementById("session-setaside-button").click();
    await sessionSetAside;
    await sessionReplaced;
    await flowResetLoaded;
    // ok(true, "successfully set aside session");

    // Restore session
    sessionReplaced = SessionManager.once("session-replaced");
    await BrowserTestUtils.synthesizeMouseAtCenter(
      "#restore",
      {},
      gBrowser.selectedBrowser
    );
    await sessionReplaced;
    // ok(true, "successfully restored session");

    let backButton = win.document.getElementById("pinebuild-back-button");

    let lastView = gStageManager.views.at(-1);
    let views = gStageManager.views;
    let viewLoaded;
    // Click the back button three times and ensure the focus remains
    // on the back button
    // info(`about to go through main assert loop >>`);
    for (let i = 2; i > 0; i--) {
      viewLoaded = PinebuildTestUtils.waitForSelectedView(views[i], win);
      PinebuildTestUtils.focusAndPressBackButton(keyChar, backButton, win);
      // ok(true, `focused and pressed back button with view ${i}`);
      await viewLoaded;
      // ok(true, `ok view${i} was loaded`);
      Assert.equal(
        win.document.activeElement,
        backButton,
        `Back button has focus after view has changed`
      );
    }
    viewLoaded = PinebuildTestUtils.waitForSelectedView(lastView, win);
    await PinebuildTestUtils.setCurrentView(lastView, win);
    await viewLoaded;
    Assert.equal(
      gStageManager.currentView,
      lastView,
      `current view was set correctly using ${keyChar}`
    );
  }
  // await BrowserTestUtils.closeWindow(win);
  await SpecialPowers.popPrefEnv();
});
