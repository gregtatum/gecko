/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const URL =
  "https://example.com/browser/toolkit/components/translations/tests/browser/translations-tester-shadow-dom-es.html";

/**
 * Check that the translation feature works with ShadowDOM.
 */
add_task(async function test_full_page_translation() {
  await autoTranslatePage({
    page: URL,
    languagePairs: [
      { fromLang: "es", toLang: "en" },
      { fromLang: "en", toLang: "es" },
    ],
    runInPage: async TranslationsTest => {
      await TranslationsTest.assertTranslationResult(
        "This is content in Luz DOM",
        function() {
          return content.document.querySelector("h1");
        },
        "ESTO SE CONTENTA EN LUZ DOM [es to en, html]"
      );

      await TranslationsTest.assertTranslationResult(
        "This is content in Shadow DOM",
        function() {
          const root = content.document.getElementById("host").shadowRoot;
          return root.querySelector("p");
        },
        "ESTO SE CONTENTO EN SHADOW DOM [es to en, html]"
      );

      await TranslationsTest.assertTranslationResult(
        "This is content in the inner root",
        function() {
          const outerRoot = content.document.getElementById("host").shadowRoot;
          const innerRoot = outerRoot.querySelector("div").shadowRoot;
          return innerRoot.querySelector("p");
        },
        "ESTO SE CONTENTA EN RAÍZ INTERIOR [es to en, html]"
      );
    },
  });
});
