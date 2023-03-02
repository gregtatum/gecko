/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { TranslationsParent } = ChromeUtils.importESModule(
  "resource://gre/actors/TranslationsParent.sys.mjs"
);

/**
 * The mochitest runs in the parent process. This function opens up a new tab,
 * opens up about:translations, and passes the test requirements into the content process.
 *
 * @template T
 *
 * @param {object} options
 *
 * @param {(args: ReturnType<typeof aboutTranslationsContentUtils>) => Promise<void>} options.runInPage
 * This function must not capture any values, as it will be cloned in the content process.
 * Any required data should be passed in using the "dataForContent" parameter. The
 * "selectors" property contains any useful selectors for the content.
 *
 * @param {boolean} [options.disabled]
 * Disable the panel through a pref.
 *
 * @param {Array<{ fromLang: string, toLang: string}>} options.languagePairs
 * The translation languages pairs to mock for the test.
 */
async function openAboutTranslations({
  disabled,
  runInPage,
  confidence,
  languageLabel,
  languagePairs,
}) {
  await SpecialPowers.pushPrefEnv({
    set: [
      // Enabled by default.
      ["browser.translations.enable", !disabled],
      ["browser.translations.logLevel", "All"],
    ],
  });

  // Start the tab at about:blank.
  let tab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "about:blank",
    true // waitForLoad
  );

  // Before loading about:translations, handle any mocking of the actor.
  if (languagePairs) {
    TranslationsParent.mockLanguagePairs(languagePairs);
  }
  if (languageLabel && confidence) {
    TranslationsParent.mockLanguageIdentification(languageLabel, confidence);
  }

  // Now load the about:translations page, since the actor could be mocked.
  BrowserTestUtils.loadURIString(tab.linkedBrowser, "about:translations");
  await BrowserTestUtils.browserLoaded(tab.linkedBrowser);

  await ContentTask.spawn(
    tab.linkedBrowser,
    null,
    // The content page is sent the text for a function. In order to inject the content
    // utils into the page, we need to do our own text manipulation.
    new Function(`
      // Set up the utils, and pass in any arguments needed.
      const utils = (${aboutTranslationsContentUtils.toString()})(content, ContentTaskUtils);

      // Finally run the test script that is run in the page, and return the result
      // so that it is properly awaited.
      return (${runInPage.toString()})(utils);
    `)
  );

  if (languagePairs) {
    TranslationsParent.mockLanguagePairs(null);
  }
  if (languageLabel && confidence) {
    TranslationsParent.mockLanguageIdentification(null, null);
  }
  BrowserTestUtils.removeTab(tab);
  await SpecialPowers.popPrefEnv();
}

/**
 * This function's text is copied and injected into the content script. Place all utils
 * that should go into content scripts here.
 */
function aboutTranslationsContentUtils(content, ContentTaskUtils) {
  const { window, document } = content;
  /**
   * Collect any relevant selectors for the page here.
   */
  const selectors = {
    pageHeader: '[data-l10n-id="about-translations-header"]',
    fromLanguageSelect: "select#language-from",
    toLanguageSelect: "select#language-to",
    translationTextarea: "textarea#translation-from",
    translationResult: "#translation-to",
    translationResultBlank: "#translation-to-blank",
  };

  return {
    selectors,

    pageIsReady() {
      return ContentTaskUtils.waitForCondition(() => {
        const element = document.querySelector(
          selectors.translationResultBlank
        );
        const { visibility } = window.getComputedStyle(element);
        return visibility === "visible";
      }, `Waiting for placeholder text to be visible."`);
    },

    /**
     * @param {bool} expectVisible - Is the element expected to be visible?
     * @param {name} name - What is a friendly name for the element?
     */
    checkElementIsVisible(expectVisible, name) {
      const expected = expectVisible ? "visible" : "hidden";
      const element = document.querySelector(selectors[name]);
      ok(Boolean(element), `Element ${name} was found.`);
      const { visibility } = window.getComputedStyle(element);
      is(
        visibility,
        expected,
        `Element ${name} was not ${expected} but should be.`
      );
    },
  };
}
