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
  <form method="POST" action="${PAGE_2_URL}">
    <input type="password" id="password" />
  </form>
</html>
`;
const PAGE_1_URL = BUILDER_URL + encodeURI(PAGE_1_MARKUP);

/**
 * Tests that navigations caused by password form submittion results in
 * Views being overwritten with the new destination.
 */

add_setup(async () => {
  await SpecialPowers.pushPrefEnv({
    set: [["browser.pinebuild.login-view-overwriting.enabled", true]],
  });
});

/**
 * Tests that a navigation from a password form submittion results in
 * the previous View being overwritten.
 */
add_task(async function test_view_overwriting() {
  let [view] = await PinebuildTestUtils.loadViews([PAGE_1_URL]);
  let browser = gBrowser.selectedBrowser;

  let viewUpdated = BrowserTestUtils.waitForEvent(
    gStageManager,
    "ViewUpdated",
    false,
    e => {
      return e.view.url.spec != PAGE_1_URL;
    }
  );
  await SpecialPowers.spawn(browser, [], async () => {
    let password = content.document.getElementById("password");
    password.value = "Some password";
    password.form.submit();
  });

  await viewUpdated;

  PinebuildTestUtils.assertViewsAre([view]);
});
