/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_setup(async () => {
  await SpecialPowers.pushPrefEnv({
    set: [["browser.pinebuild.speculatively-create-views", true]],
  });
});

/**
 * Tests that a site's failed attempt to downgrade from HTTPS to HTTP
 * doesn't result in the AVM collapsing. This is a regression test for
 * bug 1784082.
 */
add_task(async function test_failed_http_downgrade() {
  const SECURE_PAGE = "https://example.com/";
  const INSECURE_PAGE = "http://example.com/";

  await PinebuildTestUtils.loadViews(["https://example.org/"]);
  await BrowserTestUtils.openNewForegroundTab(gBrowser, SECURE_PAGE);
  let viewGroupEls = await PinebuildTestUtils.getViewGroupEls();
  Assert.equal(viewGroupEls.length, 2, "There should be 2 ViewGroup elements");
  Assert.ok(viewGroupEls[1].active, "The second ViewGroup should be active.");

  let browser = gBrowser.selectedBrowser;
  let loaded = BrowserTestUtils.browserLoaded(browser);
  let viewRemoved = BrowserTestUtils.waitForEvent(gStageManager, "ViewRemoved");
  SpecialPowers.spawn(browser, [INSECURE_PAGE], async href => {
    content.location.replace(href);
  });

  await loaded;
  await viewRemoved;
  Assert.equal(
    browser.currentURI.spec,
    SECURE_PAGE,
    "HTTP downgrade should have failed."
  );

  viewGroupEls = await PinebuildTestUtils.getViewGroupEls();
  Assert.equal(
    viewGroupEls.length,
    2,
    "Should still be a total of 2 ViewGroup elements."
  );
  Assert.ok(viewGroupEls[1].active, "Second ViewGroup should still be active.");
  await gStageManager.reset();
});

/**
 * Tests that if a content process doesn't respond soon enough with the nsISHEntry
 * for a navigation that we have a speculative InternalView created for it and
 * rendered in the AVM.
 */
add_task(async function test_speculative_internalview() {
  await PinebuildTestUtils.loadViews(["https://example.org/"]);

  // We're going to simulate a slow network load by starting a navigation
  // and then hanging the content process main thread. This should make it
  // so that the parent process sees the network activity begin, but the
  // nsISHistory mechanism won't have had any time to create an nsISHEntry
  // for the navigation.
  let hangFinished = false;
  let hangPromise = SpecialPowers.spawn(
    gBrowser.selectedBrowser,
    [],
    async () => {
      content.location = "https://example.org/browser";
      let then = Date.now();
      while (Date.now() - then < 500) {
        // Let's burn some CPU time!
      }
    }
  ).then(() => {
    hangFinished = true;
  });

  await BrowserTestUtils.waitForEvent(gStageManager, "ViewAdded");
  Assert.ok(!hangFinished, "Hang should still be underway.");

  let viewGroupEls = await PinebuildTestUtils.getViewGroupEls();
  Assert.equal(
    viewGroupEls.length,
    1,
    "Should only have a single ViewGroup element"
  );
  let viewGroup = viewGroupEls[0].viewGroup;

  Assert.equal(viewGroup.length, 2);
  Assert.equal(viewGroup.at(1).url.spec, "https://example.org/browser");
  await hangPromise;
  await gStageManager.reset();
});
