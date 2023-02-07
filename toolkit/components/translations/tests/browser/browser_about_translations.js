/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Checks that the page renders without issue, and that the expected elements
 * are there.
 */
add_task(async function test_about_translations_enabled() {
  await openAboutTranslations({
    runInPage: async ({ contentUtilsPath }) => {
      /** @type {import("./content-utils.mjs")} */
      const {
        selectElements,
        checkElementIsVisible,
      } = ChromeUtils.importESModule(contentUtilsPath);
      const els = selectElements(content);
      checkElementIsVisible(els.pageHeader, "pageHeader");
      checkElementIsVisible(els.fromSelect, "fromSelect");
      checkElementIsVisible(els.toSelect, "toSelect");
      checkElementIsVisible(els.translationTextarea, "translationTextarea");
      checkElementIsVisible(els.translationResult, "translationResult");
      checkElementIsVisible(
        els.translationResultBlank,
        "translationResultBlank"
      );
      ok(true);
    },
  });
});

/**
 * Checks that the page does not show the content when disabled.
 */
add_task(async function test_about_translations_disabled() {
  await openAboutTranslations({
    disabled: true,

    runInPage: async ({ contentUtilsPath }) => {
      /** @type {import("./content-utils.mjs")} */
      const {
        selectElements,
        checkElementIsInvisible,
      } = ChromeUtils.importESModule(contentUtilsPath);

      const els = selectElements(content);

      checkElementIsInvisible(els.pageHeader, "pageHeader");
      checkElementIsInvisible(els.fromSelect, "fromSelect");
      checkElementIsInvisible(els.toSelect, "toSelect");
      checkElementIsInvisible(els.translationTextarea, "translationTextarea");
      checkElementIsInvisible(els.translationResult, "translationResult");
      checkElementIsInvisible(
        els.translationResultBlank,
        "translationResultBlank"
      );
    },
  });
});

add_task(async function test_about_translations_dropdowns() {
  const { appLocaleAsBCP47 } = Services.locale;
  if (!appLocaleAsBCP47.startsWith("en")) {
    console.warn(
      "This test assumes to be running in an 'en' app locale, however the app locale " +
        `is set to ${appLocaleAsBCP47}. Skipping the test.`
    );
    ok(true, "Skipping test.");
    return;
  }

  await openAboutTranslations({
    languagePairs: [
      { fromLang: "en", toLang: "es" },
      { fromLang: "es", toLang: "en" },
      // This is not a bi-directional translation.
      { fromLang: "is", toLang: "en" },
    ],
    runInPage: async ({ contentUtilsPath }) => {
      /** @type {import("./content-utils.mjs")} */
      const { selectElements, assertOptions } = ChromeUtils.importESModule(
        contentUtilsPath
      );

      const { fromSelect, toSelect } = selectElements(content);

      assertOptions({
        message: "From languages have English already selected.",
        select: fromSelect,
        availableOptions: ["", "en", "is", "es"],
        selectedValue: "en",
      });

      assertOptions({
        message:
          'The "to" options do not have "en" in the list, and nothing is selected.',
        select: toSelect,
        availableOptions: ["", "is", "es"],
        selectedValue: "",
      });

      info('Switch the "to" language to Spanish.');
      toSelect.value = "es";
      toSelect.dispatchEvent(new Event("input"));

      assertOptions({
        message: 'The "from" languages no longer suggest Spanish.',
        select: fromSelect,
        availableOptions: ["", "en", "is"],
        selectedValue: "en",
      });

      assertOptions({
        message: 'The "to" options remain the same.',
        select: toSelect,
        availableOptions: ["", "is", "es"],
        selectedValue: "es",
      });
    },
  });
});

/**
 * Test that the UI actually translates text, but use a mocked translations engine.
 * The results of the "translation" will be modifying the text to be full width latin
 * characters, so that the results visually appear modified.
 */
add_task(async function test_about_translations_translations() {
  await openAboutTranslations({
    languagePairs: [
      { fromLang: "en", toLang: "fr" },
      { fromLang: "fr", toLang: "en" },
      // This is not a bi-directional translation.
      { fromLang: "is", toLang: "en" },
    ],
    runInPage: async ({ contentUtilsPath }) => {
      /** @type {import("./content-utils.mjs")} */
      const {
        selectElements,
        assertTranslationResult,
        inputValue,
      } = ChromeUtils.importESModule(contentUtilsPath);

      const {
        fromSelect,
        toSelect,
        translationTextarea,
        translationResult,
      } = selectElements(content);

      inputValue(toSelect, "fr");
      inputValue(translationTextarea, "Text to translate.");

      await assertTranslationResult(
        translationResult,
        'Ｔｅｘｔ ｔｏ ｔｒａｎｓｌａｔｅ. ［"ｅｎ" ｔｏ "ｆｒ"］'
      );

      inputValue(fromSelect, "is");
      inputValue(toSelect, "en");
      inputValue(translationTextarea, "This is the second translation.");

      await assertTranslationResult(
        translationResult,
        'Ｔｈｉｓ ｉｓ ｔｈｅ ｓｅｃｏｎｄ ｔｒａｎｓｌａｔｉｏｎ. ［"ｉｓ" ｔｏ "ｅｎ"］'
      );
    },
  });
});

add_task(async function test_about_translations_language_directions() {
  await openAboutTranslations({
    languagePairs: [
      // English (en) is LTR and Arabic (ar) is RTL.
      { fromLang: "en", toLang: "ar" },
      { fromLang: "ar", toLang: "en" },
    ],
    runInPage: async ({ contentUtilsPath }) => {
      /** @type {import("./content-utils.mjs")} */
      const { selectElements, inputValue } = ChromeUtils.importESModule(
        contentUtilsPath
      );

      const {
        fromSelect,
        toSelect,
        translationTextarea,
        translationResult,
        window,
      } = selectElements(content);

      inputValue(fromSelect, "en");
      inputValue(toSelect, "ar");
      inputValue(translationTextarea, "This text starts as LTR.");

      is(
        window.getComputedStyle(translationTextarea).direction,
        "ltr",
        "The English input is LTR"
      );
      is(
        window.getComputedStyle(translationResult).direction,
        "rtl",
        "The Arabic results are RTL"
      );

      inputValue(fromSelect, "ar");
      inputValue(toSelect, "en");
      inputValue(translationTextarea, "This text starts as RTL.");

      is(
        window.getComputedStyle(translationTextarea).direction,
        "rtl",
        "The Arabic input is RTL"
      );
      is(
        window.getComputedStyle(translationResult).direction,
        "ltr",
        "The English results are LTR"
      );
    },
  });
});
