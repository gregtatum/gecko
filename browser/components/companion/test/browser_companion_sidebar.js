/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";
/* eslint-disable no-undef */

/* Ensures that the companion settings page is shown and
   the debug sliders are available.
*/
add_task(async function test_settings_shown() {
  let menuButton = document.getElementById("PanelUI-menu-button");
  menuButton.click();
  await BrowserTestUtils.waitForEvent(window.PanelUI.mainView, "ViewShown");

  let companionSettings = document.getElementById("companion-settings-button");
  companionSettings.click();

  await BrowserTestUtils.waitForCondition(
    () => document.getElementById("companion-box") != null
  );

  let companionBrowser = document
    .getElementById("companion-box")
    .querySelector("#companion-browser");

  await SpecialPowers.spawn(companionBrowser, [], async () => {
    ok(content.document.getElementById("sliders"), "Sliders are available");
  });
});
