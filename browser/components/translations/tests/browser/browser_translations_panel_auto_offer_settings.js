/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

requestLongerTimeout(100);

/**
 * Tests that the popup is automatically offered.
 */
add_task(async function test_translations_panel_auto_offer_settings() {
  await openTranslationsSettingsMenuViaTranslationsButton();
  await hidePopup();

  const panel = document.getElementById("translations-panel");

  let popupCount = 0;
  const onPopupShown = () => popupCount++;
  panel.addEventListener("popupshown", onPopupShown);

  info(
    "Load a test page, but disable the automatic translation offering by preference."
  );
  const { cleanup, tab } = await loadTestPage({
    page: TRANSLATIONS_TESTER_ES,
    languagePairs: LANGUAGE_PAIRS,
    autoOffer: false,
  });

  const alwaysOfferId = "translations-panel-settings-always-offer-translation";

  await openTranslationsSettingsMenuViaTranslationsButton();

  await assertCheckboxState(alwaysOfferId, false);
  await clickMenuItemByL10nId(alwaysOfferId);
  await assertCheckboxState(alwaysOfferId, true);

  is(popupCount, 1, "The popup was opened once manually.");

  await waitForTranslationsPopupEvent("popupshown", () => {
    info("Wait for the popup to be shown when navigating to a different host.");
    BrowserTestUtils.loadURIString(
      tab.linkedBrowser,
      TRANSLATIONS_TESTER_ES_DOT_ORG
    );
  });

  is(
    popupCount,
    2,
    "The popup was opened a second time automatically after changing the pref."
  );

  info("Hide the popup");
  await waitForTranslationsPopupEvent("popuphidden", () => {
    click(
      getByL10nId("translations-panel-translate-cancel"),
      "Hide the popup."
    );
  })();

  panel.removeEventListener("popupshown", onPopupShown);

  await cleanup();
});
