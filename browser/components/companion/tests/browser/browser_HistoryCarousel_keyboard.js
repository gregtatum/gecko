/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_setup(async function() {
  // Temporarily re-enable thumbnails so that we capture the page previews.
  await SpecialPowers.pushPrefEnv({
    set: [["browser.pagethumbnails.capturing_disabled", false]],
  });
});

/**
 * Tests keyboard navigation and control from within the HistoryCarousel.
 */
add_task(async function test_keyboard_controls() {
  let [view0, view1, view2, view3] = await PinebuildTestUtils.loadViews([
    "https://example.com/",
    "https://example.com/browser/browser",
    "https://example.org/browser",
    "https://example.org/browser/browser/components",
  ]);

  let browser = await PinebuildTestUtils.enterHistoryCarousel();

  let { currentIndex } = await PinebuildTestUtils.getHistoryCarouselPreviews(
    browser
  );
  Assert.equal(currentIndex, 3, "Should have the last preview index selected.");

  // First, lets ensure that the keyboard left and right cursors can be used to
  // change the selected preview.
  let testKey = async (keyCode, expectedView, expectedIndex) => {
    let selected = PinebuildTestUtils.waitForSelectedView(expectedView);
    let indexChanged = PinebuildTestUtils.waitForSelectedHistoryCarouselIndex(
      browser,
      expectedIndex
    );

    // We synthesize the key event inside of a SpecialPowers.spawn to ensure
    // that the asynchronous task setting up the event listeners in
    // waitForSelectedHistoryCarouselIndex have had a chance to be set
    // up. Using BrowserTestUtils.synthesizeKey immediately here would
    // open the possibility of the key event firing _before_ the task spawned
    // in waitForSelectedHistoryCarouselIndex is done setting up.
    //
    // See bug 1743857.
    await SpecialPowers.spawn(browser, [keyCode], keyCodeToSimulate => {
      const { EventUtils } = ChromeUtils.import(
        "resource://specialpowers/SpecialPowersEventUtils.jsm"
      );
      EventUtils.synthesizeKey(keyCodeToSimulate, {}, this.content);
    });

    await indexChanged;
    await selected;
  };

  // view3 was originally selected, so by hitting the left cursor, we'll first
  // go to view2.
  await testKey("KEY_ArrowLeft", view2, 2);
  await testKey("KEY_ArrowLeft", view1, 1);
  await testKey("KEY_ArrowLeft", view0, 0);
  await testKey("KEY_ArrowRight", view1, 1);
  await testKey("KEY_ArrowRight", view2, 2);

  // Next, test that if we select a view that wasn't the original, and then
  // hit Escape, that we exit the HistoryCarousel and show the original view.
  // The original view is view3.
  let historyCarouselClosed = BrowserTestUtils.waitForEvent(
    window,
    "HistoryCarousel:TransitionEnd"
  );
  testKey("KEY_Escape", view3, 3);
  await historyCarouselClosed;

  // Now re-enter HistoryCarousel, select view2, and hit Enter. This should
  // cause view2 to be the selected view.
  browser = await PinebuildTestUtils.enterHistoryCarousel();
  await testKey("KEY_ArrowLeft", view2, 2);
  historyCarouselClosed = BrowserTestUtils.waitForEvent(
    window,
    "HistoryCarousel:TransitionEnd"
  );
  let viewChangedPromise = PinebuildTestUtils.waitForSelectedView(view2);
  await BrowserTestUtils.synthesizeKey("KEY_Enter", {}, browser);
  await historyCarouselClosed;
  await viewChangedPromise;

  Assert.equal(gStageManager.currentView, view2);
});

/**
 * Tests that keyboard focus can be brought into and out of the HistoryCarousel.
 */
add_task(async function test_keyboard_focus() {
  await PinebuildTestUtils.loadViews([
    "https://example.com/",
    "https://example.com/browser/browser",
    "https://example.org/browser",
    "https://example.org/browser/browser/components",
  ]);

  let carouselBrowser = await PinebuildTestUtils.enterHistoryCarousel();

  // Reverse-focus until we hit the toolbartabstop at the start of the toolbar.
  do {
    Services.focus.moveFocus(
      window,
      null,
      Ci.nsIFocusManager.MOVEFOCUS_BACKWARD,
      Ci.nsIFocusManager.FLAG_BYKEY
    );
    // We need to wait a tick of the event loop to make sure the focusedElement
    // gets properly updated.
    await new Promise(resolve => SimpleTest.executeSoon(resolve));
  } while (Services.focus.focusedElement.tagName != "toolbartabstop");

  Assert.ok("Able to focus to the start of the toolbar.");

  // Now forward-focus until we hit the HistoryCarousel browser again.
  do {
    Services.focus.moveFocus(
      window,
      null,
      Ci.nsIFocusManager.MOVEFOCUS_FORWARD,
      Ci.nsIFocusManager.FLAG_BYKEY
    );
    // We need to wait a tick of the event loop to make sure the focusedElement
    // gets properly updated.
    await new Promise(resolve => SimpleTest.executeSoon(resolve));
  } while (Services.focus.focusedElement != carouselBrowser);

  Assert.ok("Able to re-focus the HistoryCarousel browser");

  await PinebuildTestUtils.exitHistoryCarousel();
});

/**
 * Tests that the gClickAndHoldListenersOnElement mechanism that Megaback uses
 * doesn't cause the StageManager to go back twice in a row if the user uses
 * the keyboard to press the back button. (MR2-2882)
 * Additionally tests that focus does not move from the back button when
 * using a keyboard to activate the back button. (MR2-1608)
 */
add_task(async function test_back_button_keyboard_events() {
  let [view1, view2] = await PinebuildTestUtils.loadViews([
    "https://example.com/",
    "https://example.com/browser/",
  ]);
  let backButton = document.getElementById("pinebuild-back-button");

  Assert.equal(gStageManager.currentView, view2);

  await BrowserTestUtils.openNewForegroundTab(gBrowser, "https://example.org/");

  let view3 = gStageManager.currentView;
  Assert.notEqual(view2, view3);

  async function focusAndPressBackButton(keyChar) {
    let viewChangedPromise = BrowserTestUtils.waitForEvent(
      gStageManager,
      "ViewChanged"
    );
    // toolbarbutton's are not focusable normally, unless the user begins
    // using the keyboard to navigate. We temporarily force focusability
    // here.
    backButton.setAttribute("tabindex", "-1");
    backButton.focus();
    backButton.removeAttribute("tabindex");
    EventUtils.synthesizeKey(keyChar);
    await viewChangedPromise;
    // Let the event loop tick once more time to make sure there
    // aren't any other calls to goBack() in the same tick.
    await new Promise(resolve => {
      executeSoon(resolve);
    });
  }

  for (let keyChar of ["KEY_Enter", " "]) {
    await focusAndPressBackButton(keyChar);
    Assert.equal(gStageManager.currentView, view2);
    Assert.equal(
      document.activeElement,
      backButton,
      "Back button has focus after view has changed"
    );
    await focusAndPressBackButton(keyChar);
    Assert.equal(gStageManager.currentView, view1);
    Assert.equal(
      document.activeElement,
      backButton,
      "Back button has focus after view has changed"
    );
    await PinebuildTestUtils.setCurrentView(view3);
  }
});
