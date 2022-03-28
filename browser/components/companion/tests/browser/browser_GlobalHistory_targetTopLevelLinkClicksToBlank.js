/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const TEST_PAGE = "https://example.com/browser/";
const TEST_PAGE_2 = "https://example.com/browser/components/";
// There is an <a> element with this href=".." in the TEST_PAGE
// that we will click, which should take us up a level.
const LINK_URL = "https://example.com/";

/**
 * This test exercises the behaviour where user-initiated link clicks on
 * the top-level document result in pageloads in a _blank target in a new
 * browser window.
 *
 * This test is extremely similar to
 * browser_GlobalHistory_TopLevelNavigationDelegate.js because both
 * mechanisms have the same goals. The difference in this variation is
 * that a new window must be opened after the targetTopLevelLinkClicksToBlank
 * pref is set because the behaviour change only manifests in browser elements
 * created _after_ the pref flip.
 */

add_setup(async function setup() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["browser.tabs.openNewTabForMostNavigations", false],
      ["browser.pinebuild.targetTopLevelLinkClicksToBlank", true],
    ],
  });
});

/**
 * Test that a user-initiated link click results in targeting to a new
 * <browser> element, and that this properly sets the referrer on the newly
 * loaded document.
 */
add_task(async function target_to_new_blank_browser() {
  let win = await BrowserTestUtils.openNewBrowserWindow();
  await PinebuildTestUtils.loadViews([TEST_PAGE], win);
  let currentBrowser = win.gBrowser.selectedBrowser;
  let newBrowserCreated = BrowserTestUtils.waitForNewTab(
    win.gBrowser,
    LINK_URL
  );
  await SpecialPowers.spawn(currentBrowser, [], async () => {
    let anchor = content.document.querySelector(`a[href=".."]`);
    content.windowUtils.setHandlingUserInput(true);
    anchor.click();
  });
  let { linkedBrowser: newBrowser } = await newBrowserCreated;

  Assert.ok(
    currentBrowser !== newBrowser,
    "A new browser should have been created."
  );
  await SpecialPowers.spawn(newBrowser, [TEST_PAGE], async referrer => {
    Assert.equal(
      content.document.referrer,
      referrer,
      "Should have gotten the right referrer set"
    );
  });

  await BrowserTestUtils.closeWindow(win);
});

/**
 * Test that we don't target to _blank loads caused by:
 * 1. POST requests
 * 2. Any load that isn't "normal" (in the nsIDocShell.LOAD_CMD_NORMAL sense)
 * 3. Any loads that are caused by location.replace
 * 4. Any loads that were caused by setting location.href
 * 5. Link clicks fired without user interaction.
 */
add_task(async function skip_blank_target_for_some_loads() {
  let win = await BrowserTestUtils.openNewBrowserWindow();
  await PinebuildTestUtils.loadViews([TEST_PAGE], win);
  let currentBrowser = win.gBrowser.selectedBrowser;
  let ensureSingleBrowser = () => {
    Assert.equal(
      win.gBrowser.browsers.length,
      1,
      "There should only be 1 browser."
    );
  };

  // First we'll test a POST request
  let sameBrowserLoad = BrowserTestUtils.browserLoaded(
    currentBrowser,
    false,
    TEST_PAGE
  );
  await SpecialPowers.spawn(currentBrowser, [], async () => {
    let doc = content.document;
    let form = doc.createElement("form");
    form.setAttribute("method", "post");
    doc.body.appendChild(form);
    form.submit();
  });
  await sameBrowserLoad;
  ensureSingleBrowser();

  // Next, we'll try a non-normal load - specifically, we'll try a reload.
  // Since we've got a page loaded via a POST request, an attempt to reload
  // will cause the "repost" dialog to appear, so we temporarily allow the
  // repost to go through with the always_accept testing pref.
  await SpecialPowers.pushPrefEnv({
    set: [["dom.confirm_repost.testing.always_accept", true]],
  });
  sameBrowserLoad = BrowserTestUtils.browserLoaded(
    currentBrowser,
    false,
    TEST_PAGE
  );
  await SpecialPowers.spawn(currentBrowser, [], async () => {
    content.location.reload();
  });
  await sameBrowserLoad;
  ensureSingleBrowser();

  // Next, we'll try a location.replace
  sameBrowserLoad = BrowserTestUtils.browserLoaded(
    currentBrowser,
    false,
    TEST_PAGE_2
  );
  await SpecialPowers.spawn(currentBrowser, [TEST_PAGE_2], async page2 => {
    content.location.replace(page2);
  });
  await sameBrowserLoad;
  ensureSingleBrowser();

  // Finally we'll try setting location.href
  sameBrowserLoad = BrowserTestUtils.browserLoaded(
    currentBrowser,
    false,
    TEST_PAGE
  );
  await SpecialPowers.spawn(currentBrowser, [TEST_PAGE], async page1 => {
    content.location.href = page1;
  });
  await sameBrowserLoad;
  ensureSingleBrowser();

  // Now that we're back at TEST_PAGE, let's try a scripted link click. This
  // shouldn't target to _blank.
  sameBrowserLoad = BrowserTestUtils.browserLoaded(
    currentBrowser,
    false,
    LINK_URL
  );
  await SpecialPowers.spawn(currentBrowser, [], async () => {
    let anchor = content.document.querySelector(`a[href=".."]`);
    anchor.click();
  });
  await sameBrowserLoad;
  ensureSingleBrowser();

  await BrowserTestUtils.closeWindow(win);
});
