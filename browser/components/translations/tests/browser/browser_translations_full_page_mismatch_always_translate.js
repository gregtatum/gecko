/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const cases = [
  {
    alwaysTranslateLanguages: "es,fr",
    neverTranslateLanguages: "",
    isTranslated: true,
    message: "The page should automatically translate the detected Spanish",
  },
  {
    alwaysTranslateLanguages: "es",
    neverTranslateLanguages: "",
    isTranslated: false,
    message:
      'If the <html> lang attribute is not in "always translate", the page\'s language ' +
      "will not be identified. This is a false negative, but is expected so that we " +
      "don't have to run language identification.",
  },
  {
    alwaysTranslateLanguages: "es,fr",
    neverTranslateLanguages: "es",
    isTranslated: false,
    message: "Respect the never translate pref.",
  },
];

/**
 * Run through test cases around always/never translating when there is a mismatch
 * of the <html> lang attribute, and the identified language.
 */
add_task(async function test_autotranslate_with_langtags_mismatch() {
  for (const {
    alwaysTranslateLanguages,
    isTranslated,
    neverTranslateLanguages,
    message,
  } of cases) {
    TranslationsParent.testAutomaticPopup = true;
    const { cleanup, runInPage } = await loadTestPage({
      page: SPANISH_LANG_MISMATCH_PAGE_URL,
      languagePairs: LANGUAGE_PAIRS,
      autoDownloadFromRemoteSettings: true,
      prefs: [
        [
          "browser.translations.alwaysTranslateLanguages",
          alwaysTranslateLanguages,
        ],
        [
          "browser.translations.neverTranslateLanguages",
          neverTranslateLanguages,
        ],
      ],
    });

    await FullPageTranslationsTestUtils.assertTranslationsButton(
      { button: true, circleArrows: false, locale: isTranslated, icon: true },
      "The translations button is visible."
    );

    if (isTranslated) {
      await FullPageTranslationsTestUtils.assertPageIsTranslated({
        fromLanguage: "es",
        toLanguage: "en",
        runInPage,
        message,
      });
    } else {
      await FullPageTranslationsTestUtils.assertPageIsUntranslated(
        runInPage,
        message
      );
    }

    TranslationsParent.testAutomaticPopup = false;
    await cleanup();
  }
});
