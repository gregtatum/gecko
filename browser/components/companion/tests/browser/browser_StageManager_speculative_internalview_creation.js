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
  let viewGroupEls = await PinebuildTestUtils.getViewGroups();
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

  viewGroupEls = await PinebuildTestUtils.getViewGroups();
  Assert.equal(
    viewGroupEls.length,
    2,
    "Should still be a total of 2 ViewGroup elements."
  );
  Assert.ok(viewGroupEls[1].active, "Second ViewGroup should still be active.");
});
