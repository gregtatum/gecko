/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_popup_has_correct_UI() {
  SpecialPowers.pushPrefEnv({ set: [["dom.disable_open_during_load", false]] });
  const TEST_URL = `https://example.com/browser/browser/components/companion/tests/browser/example.html`;
  let popupOpened = BrowserTestUtils.waitForNewWindow({
    url: TEST_URL,
  });

  BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "data:text/html,<html><script>popup=open('" +
      TEST_URL +
      "','','width=400,height=400')</script>"
  );
  const win = await popupOpened;
  const doc = win.document;
  let panelUIMenuButton = doc.getElementById("PanelUI-menu-button");
  let searchIcon = doc.getElementById("pinebuild-search-icon-box");
  ok(win.gURLBar, "URL bar exists in the popup");
  isnot(win.gURLBar.clientWidth, 0, "URL bar is visible in the popup");
  ok(win.gURLBar.readOnly, "location bar is read-only in the popup");
  is(
    BrowserTestUtils.is_visible(panelUIMenuButton),
    false,
    "App menu button should not be visible in a popup"
  );
  is(
    BrowserTestUtils.is_visible(searchIcon),
    false,
    "Search icon should not be visible in a popup"
  );
  is(
    win.gURLBar.value,
    TEST_URL,
    "URL should be correctly displayed in a popup"
  );
  BrowserTestUtils.closeWindow(win);
});
