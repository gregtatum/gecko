/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Tests that the popup is automatically offered.
 */
add_task(async function test_translations_panel_auto_offer_settings() {
  info("Load the test page in English so that no popups will be offered.");
  const { cleanup, tab } = await loadTestPage({
    page: TRANSLATIONS_TESTER_ES,
    languagePairs: LANGUAGE_PAIRS,
    // Use the auto offer mechanics, but default the pref to the off position.
    autoOffer: true,
    prefs: [["browser.translations.automaticallyPopup", false]],
  });

  info("Open the popup and gear icon menu.");
  const alwaysOfferId = "translations-panel-settings-always-offer-translation";

  await openTranslationsSettingsMenuViaTranslationsButton();
  await assertCheckboxState(alwaysOfferId, false);

  info("Turn on automatic offering of popups");
  await clickMenuItemByL10nId(alwaysOfferId);

  await openTranslationsSettingsMenuViaTranslationsButton();
  await assertCheckboxState(alwaysOfferId, true);

  await hidePopup();

  const panel = document.getElementById("translations-panel");

  let popupCount = 0;
  const onPopupShown = () => popupCount++;
  panel.addEventListener("popupshown", onPopupShown);

  await waitForTranslationsPopupEvent("popupshown", () => {
    info("Wait for the popup to be shown when navigating to a different host.");
    BrowserTestUtils.loadURIString(
      tab.linkedBrowser,
      TRANSLATIONS_TESTER_ES_DOT_ORG
    );
  });

  is(popupCount, 1, "The popup was opened.");

  panel.removeEventListener("popupshown", onPopupShown);

  await cleanup();
});
