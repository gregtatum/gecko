/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const BUILDER_URL = "https://example.com/document-builder.sjs?html=";
const PAGE_2_MARKUP = `
<html>
  <h1>This is page 2</h1>
</html>
`;
const PAGE_2_URL = BUILDER_URL + encodeURI(PAGE_2_MARKUP);

const PAGE_1_MARKUP = `
<html>
  <h1>This is page 1</h1>
  <a id="link" href="${PAGE_2_URL}">Click for manual navigation.</a>
  <script>
    setTimeout(() => {
      let params = new URLSearchParams(window.location.href);
      if (params.get("auto") == "true") {
        window.location = "${PAGE_2_URL}";
      }
    }, 0);
  </script>
</html>
`;
const PAGE_1_URL = BUILDER_URL + encodeURI(PAGE_1_MARKUP);
const PAGE_1_URL_AUTO = PAGE_1_URL + "&auto=true";

/**
 * Tests that quick navigations without explicit user interactions
 * result in Views being overwritten with the new destination when
 * appropriate.
 */

add_task(async function setup() {
  // We enable overwriting, and then set the threshold to a large
  // number so that every navigation is considered quick for testing.
  await SpecialPowers.pushPrefEnv({
    set: [
      ["browser.pinebuild.interstitial-view-overwriting.enabled", true],
      ["browser.pinebuild.interstitial-view-overwriting.threshold_ms", 100000],
    ],
  });
});

/**
 * Tests that a quick navigation without user interaction results in
 * the previous View being overwritten.
 */
add_task(async function test_view_overwriting() {
  gGlobalHistory.reset();

  let browser = gBrowser.selectedBrowser;

  let viewUpdated = BrowserTestUtils.waitForEvent(
    gGlobalHistory,
    "ViewUpdated",
    false,
    e => {
      return e.view.url.spec != PAGE_1_URL_AUTO;
    }
  );
  let newViewCreated = PinebuildTestUtils.waitForNewView(
    browser,
    PAGE_1_URL_AUTO
  );
  BrowserTestUtils.loadURI(browser, PAGE_1_URL_AUTO);
  await newViewCreated;
  let { view } = await viewUpdated;

  Assert.equal(view.url.spec, PAGE_2_URL, "Should have gone to second page.");

  PinebuildTestUtils.assertViewsAre([view]);
});

/**
 * Tests that a quick navigation with user interaction does not overwrite
 * the previous View, and creates a new View instead.
 */
add_task(async function test_no_overwriting_with_interaction() {
  gGlobalHistory.reset();

  let browser = gBrowser.selectedBrowser;

  let newViewCreated = PinebuildTestUtils.waitForNewView(browser, PAGE_1_URL);
  BrowserTestUtils.loadURI(browser, PAGE_1_URL);
  let view1 = await newViewCreated;

  // We're simulating a user interaction here, which means that if the
  // TopLevelNavigationDelegate is enabled, then the newly created View
  // will also have a newly created <browser>, which means we can't use
  // `PinebuildTestUtils.waitForNewView`.
  Assert.ok(
    Services.prefs.getBoolPref("browser.tabs.openNewTabForMostNavigations"),
    "TopLevelNavigationDelegate should be enabled for this test to work."
  );

  let viewAdded = BrowserTestUtils.waitForEvent(
    gGlobalHistory,
    "ViewAdded",
    false,
    e => {
      return e.view.url.spec != PAGE_1_URL;
    }
  );
  await SpecialPowers.spawn(browser, [], async () => {
    content.document.userInteractionForTesting();
    let link = content.document.getElementById("link");
    link.click();
  });

  let { view: view2 } = await viewAdded;

  Assert.equal(view2.url.spec, PAGE_2_URL, "Should have gone to second page.");

  PinebuildTestUtils.assertViewsAre([view1, view2]);
});

/**
 * Tests that a "slow" navigation does not cause the previous View to
 * be overwritten.
 */
add_task(async function test_no_overwriting_with_interaction() {
  await SpecialPowers.pushPrefEnv({
    set: [["browser.pinebuild.interstitial-view-overwriting.threshold_ms", 0]],
  });

  gGlobalHistory.reset();

  let browser = gBrowser.selectedBrowser;

  let viewAdded = BrowserTestUtils.waitForEvent(
    gGlobalHistory,
    "ViewAdded",
    false,
    e => {
      return e.view.url.spec != PAGE_1_URL_AUTO;
    }
  );
  let newViewCreated = PinebuildTestUtils.waitForNewView(
    browser,
    PAGE_1_URL_AUTO
  );
  BrowserTestUtils.loadURI(browser, PAGE_1_URL_AUTO);
  let view1 = await newViewCreated;
  let { view: view2 } = await viewAdded;

  Assert.equal(view2.url.spec, PAGE_2_URL, "Should have gone to second page.");

  PinebuildTestUtils.assertViewsAre([view1, view2]);
});
