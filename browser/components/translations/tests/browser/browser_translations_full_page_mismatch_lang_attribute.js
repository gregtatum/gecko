/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Test when the page content and the <html> lang attribute have a mismatch, that a popup
 * is not shown, and that the icon is visible with the detected page's content.
 */
add_task(async function test_full_page_mismatch_lang_attribute() {
  TranslationsParent.testAutomaticPopup = true;
  let wasPopupShown = false;
  const popupShown = FullPageTranslationsTestUtils.waitForPanelPopupEvent(
    "popupshown",
    () => {}
  ).then(() => {
    wasPopupShown = true;
  });

  const { cleanup, runInPage } = await loadTestPage({
    page: SPANISH_LANG_MISMATCH_PAGE_URL,
    languagePairs: LANGUAGE_PAIRS,
  });

  await FullPageTranslationsTestUtils.assertTranslationsButton(
    { button: true, circleArrows: false, locale: false, icon: true },
    "The translations button is visible."
  );

  await FullPageTranslationsTestUtils.assertPageIsUntranslated(runInPage);

  // It's hard to test a negative that relies on asynchronous behavior, but add a check
  // anyway. If this ever fails it could mean the popup is incorrectly being shown which
  // is a regression, it may be intermittent.
  is(wasPopupShown, false, "A translation was not offered.");

  await FullPageTranslationsTestUtils.openPanel({
    expectedFromLanguage: "es",
    expectedToLanguage: "en",
    onOpenPanel: FullPageTranslationsTestUtils.assertPanelViewDefault,
  });

  await popupShown;
  TranslationsParent.testAutomaticPopup = false;
  await cleanup();
});
