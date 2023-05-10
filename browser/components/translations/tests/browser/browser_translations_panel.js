/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const languagePairs = [
  { fromLang: "es", toLang: "en", isBeta: false },
  { fromLang: "en", toLang: "es", isBeta: false },
  { fromLang: "fr", toLang: "en", isBeta: false },
  { fromLang: "en", toLang: "fr", isBeta: false },
  { fromLang: "en", toLang: "uk", isBeta: true },
  { fromLang: "uk", toLang: "en", isBeta: true },
];

const englishPageUrl = TRANSLATIONS_TESTER_EN;
const spanishPageUrlDotCom = TRANSLATIONS_TESTER_ES_DOT_COM;
const spanishPageUrlDotOrg = TRANSLATIONS_TESTER_ES_DOT_ORG;
const spanishPageUrlDotCom2 = TRANSLATIONS_TESTER_ES_DOT_COM_2;

/**
 * Test that the translations button is correctly visible when navigating between pages.
 */
add_task(async function test_button_visible_navigation() {
  info("Start at a page in Spanish.");
  const { cleanup } = await loadTestPage({
    page: spanishPageUrlDotCom,
    languagePairs,
  });

  await assertTranslationsButton(
    button => !button.hidden,
    "The button should be visible since the page can be translated from Spanish."
  );

  await navigate(englishPageUrl, "Navigate to an English page.");

  await assertTranslationsButton(
    button => button.hidden,
    "The button should be invisible since the page is in English."
  );

  await navigate(spanishPageUrlDotCom, "Navigate back to a Spanish page.");

  await assertTranslationsButton(
    button => !button.hidden,
    "The button should be visible again since the page is in Spanish."
  );

  await cleanup();
});

/**
 * Test that the translations button is correctly visible when opening and switch tabs.
 */
add_task(async function test_button_visible() {
  info("Start at a page in Spanish.");

  const { cleanup, tab: spanishTab } = await loadTestPage({
    page: spanishPageUrlDotCom,
    languagePairs,
  });

  await assertTranslationsButton(
    button => !button.hidden,
    "The button should be visible since the page can be translated from Spanish."
  );

  const { removeTab, tab: englishTab } = await addTab(
    englishPageUrl,
    "Creating a new tab for a page in English."
  );

  await assertTranslationsButton(
    button => button.hidden,
    "The button should be invisible since the tab is in English."
  );

  await switchTab(spanishTab);

  await assertTranslationsButton(
    button => !button.hidden,
    "The button should be visible again since the page is in Spanish."
  );

  await switchTab(englishTab);

  await assertTranslationsButton(
    button => button.hidden,
    "Don't show for english pages"
  );

  await removeTab();
  await cleanup();
});

/**
 * Tests a basic panel open, translation, and restoration to the original language.
 */
add_task(async function test_translations_panel() {
  const { cleanup, runInPage } = await loadTestPage({
    page: spanishPageUrlDotCom,
    languagePairs,
  });

  const button = await assertTranslationsButton(
    b => !b.hidden,
    "The button is available."
  );

  await runInPage(async TranslationsTest => {
    const { getH1 } = TranslationsTest.getSelectors();
    await TranslationsTest.assertTranslationResult(
      "The page's H1 is in Spanish.",
      getH1,
      "Don Quijote de La Mancha"
    );
  });

  await waitForTranslationsPopupEvent("popupshown", () => {
    click(button, "Opening the popup");
  });

  await waitForTranslationsPopupEvent("popuphidden", () => {
    click(
      getByL10nId("translations-panel-default-translate-button"),
      "Start translating by clicking the translate button."
    );
  });

  await runInPage(async TranslationsTest => {
    const { getH1 } = TranslationsTest.getSelectors();
    await TranslationsTest.assertTranslationResult(
      "The pages H1 is translated.",
      getH1,
      "DON QUIJOTE DE LA MANCHA [es to en, html]"
    );
  });

  await waitForTranslationsPopupEvent("popupshown", () => {
    click(button, "Re-opening the popup");
  });

  await waitForTranslationsPopupEvent("popuphidden", () => {
    click(
      getByL10nId("translations-panel-revisit-restore-button"),
      "Click the restore language button."
    );
  });

  await runInPage(async TranslationsTest => {
    const { getH1 } = TranslationsTest.getSelectors();
    await TranslationsTest.assertTranslationResult(
      "The page's H1 is restored to Spanish.",
      getH1,
      "Don Quijote de La Mancha"
    );
  });

  await cleanup();
});

/**
 * Tests translating, and then immediately translating to a new language.
 */
add_task(async function test_translations_panel() {
  const { cleanup, runInPage } = await loadTestPage({
    page: spanishPageUrlDotCom,
    languagePairs,
  });

  const button = await assertTranslationsButton(
    b => !b.hidden,
    "The button is available."
  );

  await runInPage(async TranslationsTest => {
    const { getH1 } = TranslationsTest.getSelectors();
    await TranslationsTest.assertTranslationResult(
      "The page's H1 is in Spanish.",
      getH1,
      "Don Quijote de La Mancha"
    );
  });

  await waitForTranslationsPopupEvent("popupshown", () => {
    click(button, "Opening the popup");
  });

  await waitForTranslationsPopupEvent("popuphidden", () => {
    click(
      getByL10nId("translations-panel-default-translate-button"),
      "Start translating by clicking the translate button."
    );
  });

  await runInPage(async TranslationsTest => {
    const { getH1 } = TranslationsTest.getSelectors();
    await TranslationsTest.assertTranslationResult(
      "The pages H1 is translated.",
      getH1,
      "DON QUIJOTE DE LA MANCHA [es to en, html]"
    );
  });

  await waitForTranslationsPopupEvent("popupshown", () => {
    click(button, "Re-opening the popup");
  });

  info('Switch to language to "fr"');
  const toSelect = getById("translations-panel-revisit-to");
  toSelect.value = "fr";
  toSelect.dispatchEvent(new Event("command"));

  await waitForTranslationsPopupEvent("popuphidden", () => {
    click(
      getByL10nId("translations-panel-revisit-translate-button"),
      "Re-translate the page by clicking the translate button."
    );
  });

  await runInPage(async TranslationsTest => {
    const { getH1 } = TranslationsTest.getSelectors();
    await TranslationsTest.assertTranslationResult(
      "The pages H1 is translated using the changed languages.",
      getH1,
      "DON QUIJOTE DE LA MANCHA [es to fr, html]"
    );
  });

  await cleanup();
});

/**
 * Tests switching the language.
 */
add_task(async function test_translations_panel_switch_language() {
  const { cleanup, runInPage } = await loadTestPage({
    page: spanishPageUrlDotCom,
    languagePairs,
  });

  const button = await assertTranslationsButton(
    b => !b.hidden,
    "The button is available."
  );

  await runInPage(async TranslationsTest => {
    const { getH1 } = TranslationsTest.getSelectors();
    await TranslationsTest.assertTranslationResult(
      "The page's H1 is in Spanish.",
      getH1,
      "Don Quijote de La Mancha"
    );
  });

  await waitForTranslationsPopupEvent("popupshown", () => {
    click(button, "Opening the popup");
  });

  const gearIcon = getByL10nId("translations-panel-settings-button");
  click(gearIcon, "Open the preferences menu");

  await waitForViewShown(() => {
    info("Switch to choose language view");
    getByL10nId(
      "translations-panel-settings-change-source-language"
    ).doCommand();
  });

  const translateButton = getByL10nId(
    "translations-panel-default-translate-button"
  );
  const fromSelect = getById("translations-panel-dual-from");
  const toSelect = getById("translations-panel-dual-to");

  ok(translateButton.disabled, "The translate button starts as disabled");

  info('Switch from language to "en"');
  fromSelect.value = "en";
  fromSelect.dispatchEvent(new Event("command"));

  info('Switch to language to "fr"');
  toSelect.value = "fr";
  toSelect.dispatchEvent(new Event("command"));

  ok(!translateButton.disabled, "The translate button can now be used");

  info('Switch to language to "en"');
  toSelect.value = "en";
  toSelect.dispatchEvent(new Event("command"));

  ok(
    translateButton.disabled,
    "Choosing to translate to and from English causes the translate button to be disabled again."
  );

  info('Switch to language back to "fr"');
  toSelect.value = "fr";
  toSelect.dispatchEvent(new Event("command"));

  ok(!translateButton.disabled, "The translate button can be used again.");

  await waitForTranslationsPopupEvent("popuphidden", () => {
    click(
      translateButton,
      "Start translating by clicking the translate button."
    );
  });

  await runInPage(async TranslationsTest => {
    const { getH1 } = TranslationsTest.getSelectors();
    await TranslationsTest.assertTranslationResult(
      "The pages H1 is translated using the changed languages.",
      getH1,
      "DON QUIJOTE DE LA MANCHA [en to fr, html]"
    );
  });

  await cleanup();
});

/**
 * Tests a panel open, and hitting the cancel button.
 */
add_task(async function test_translations_panel_cancel() {
  const { cleanup } = await loadTestPage({
    page: spanishPageUrlDotCom,
    languagePairs,
  });

  const button = await assertTranslationsButton(
    b => !b.hidden,
    "The button is available."
  );

  await waitForTranslationsPopupEvent("popupshown", () => {
    click(button, "Opening the popup");
  });

  await waitForTranslationsPopupEvent("popuphidden", () => {
    click(
      getByL10nId("translations-panel-default-translate-cancel"),
      "Click the cancel button."
    );
  });

  await cleanup();
});

/**
 * Tests that languages are displayed correctly as being in beta or not.
 */
add_task(async function test_translations_panel_display_beta_languages() {
  const { cleanup } = await loadTestPage({
    page: spanishPageUrlDotCom,
    languagePairs,
  });

  function assertBetaDisplay(selectElement) {
    const betaL10nId = "translations-panel-displayname-beta";
    const options = selectElement.firstChild.getElementsByTagName("menuitem");
    for (const option of options) {
      for (const languagePair of languagePairs) {
        if (
          languagePair.fromLang === option.value ||
          languagePair.toLang === option.value
        ) {
          if (option.getAttribute("data-l10n-id") === betaL10nId) {
            is(
              languagePair.isBeta,
              true,
              `Since data-l10n-id was ${betaL10nId} for ${option.value}, then it must be part of a beta language pair, but it was not.`
            );
          }
          if (!languagePair.isBeta) {
            is(
              option.getAttribute("data-l10n-id") === betaL10nId,
              false,
              `Since the languagePair is non-beta, the language option ${option.value} should not have a data-l10-id of ${betaL10nId}, but it does.`
            );
          }
        }
      }
    }
  }

  const fromSelect = document.getElementById("translations-panel-dual-from");
  const toSelect = document.getElementById("translations-panel-dual-to");

  assertBetaDisplay(fromSelect);
  assertBetaDisplay(toSelect);

  await cleanup();
});

/**
 * Test managing the languages menu item.
 */
add_task(async function test_translations_panel_manage_languages() {
  const { cleanup } = await loadTestPage({
    page: spanishPageUrlDotCom,
    languagePairs,
  });

  const button = await assertTranslationsButton(
    b => !b.hidden,
    "The button is available."
  );

  await waitForTranslationsPopupEvent("popupshown", () => {
    click(button, "Opening the popup");
  });

  const gearIcon = getByL10nId("translations-panel-settings-button");
  click(gearIcon, "Open the preferences menu");

  const manageLanguages = getByL10nId(
    "translations-panel-settings-manage-languages"
  );
  info("Choose to manage the languages.");
  manageLanguages.doCommand();

  await TestUtils.waitForCondition(
    () => gBrowser.currentURI.spec === "about:preferences#general",
    "Waiting for about:preferences to be opened."
  );

  info("Remove the about:preferences tab");
  gBrowser.removeCurrentTab();

  await cleanup();
});

/**
 * Tests the effects that toggling the always-translate-languages menuitem
 * has on subsequent page loads.
 */
add_task(async function test_page_loads_with_always_translate_language() {
  const { cleanup, runInPage } = await loadTestPage({
    page: spanishPageUrlDotCom,
    languagePairs,
    prefs: [["browser.translations.alwaysTranslateLanguages", "pl,fr"]],
  });

  // The document language "es" is not in the alwaysTranslateLanguages pref,
  // so the page should be untranslated, in its original form.
  await runInPage(async TranslationsTest => {
    const { getH1 } = TranslationsTest.getSelectors();
    await TranslationsTest.assertTranslationResult(
      "The page's H1 is in Spanish.",
      getH1,
      "Don Quijote de La Mancha"
    );
  });

  // Simulate clicking always-translate-language in the preferences menu,
  // adding the document language from the alwaysTranslateLanguages pref.
  await openPreferencesMenu();
  await toggleAlwaysTranslateLanguage();

  // Reload the page
  await navigate(spanishPageUrlDotCom);

  // The page should now be automatically translated because the document language
  // should be added to the always-translate pref.
  await runInPage(async TranslationsTest => {
    const { getH1 } = TranslationsTest.getSelectors();
    await TranslationsTest.assertTranslationResult(
      "The page's H1 is translated automatically",
      getH1,
      "DON QUIJOTE DE LA MANCHA [es to en, html]"
    );
  });

  // Simulate clicking always-translate-language in the preferences menu
  // removing the document language from the alwaysTranslateLanguages pref.
  await openPreferencesMenu();
  await toggleAlwaysTranslateLanguage();

  // Reload the page
  await navigate(spanishPageUrlDotCom);

  // The page should no longer automatically translated because the document language
  // should be removed from the always-translate pref.
  await runInPage(async TranslationsTest => {
    const { getH1 } = TranslationsTest.getSelectors();
    await TranslationsTest.assertTranslationResult(
      "The page's H1 is in Spanish.",
      getH1,
      "Don Quijote de La Mancha"
    );
  });

  await cleanup();
});

/**
 * Tests the effect that toggling the never-translate-languages menuitem
 * has on subsequent page loads.
 */
add_task(async function test_page_loads_with_never_translate_language() {
  const { cleanup, runInPage } = await loadTestPage({
    page: spanishPageUrlDotCom,
    languagePairs,
    prefs: [["browser.translations.neverTranslateLanguages", "pl,fr"]],
  });

  await assertTranslationsButton(
    button => !button.hidden,
    "The translations button should be visible"
  );

  // The document language "es" is not in the neverTranslateLanguages pref,
  // so the page should be untranslated, in its original form.
  await runInPage(async TranslationsTest => {
    const { getH1 } = TranslationsTest.getSelectors();
    await TranslationsTest.assertTranslationResult(
      "The page's H1 is in Spanish.",
      getH1,
      "Don Quijote de La Mancha"
    );
  });

  // Simulate clicking never-translate-language in the preferences menu,
  // adding the document language from the neverTranslateLanguages pref.
  await openPreferencesMenu();
  await toggleNeverTranslateLanguage();

  // Reload the page
  await navigate(spanishPageUrlDotCom);

  await assertTranslationsButton(
    button => button.hidden,
    "The translations button should be invisible"
  );

  // The page should still be in its original, untranslated form because
  // the document language is in the neverTranslateLanguages pref.
  await runInPage(async TranslationsTest => {
    const { getH1 } = TranslationsTest.getSelectors();
    await TranslationsTest.assertTranslationResult(
      "The page's H1 is in Spanish.",
      getH1,
      "Don Quijote de La Mancha"
    );
  });

  await cleanup();
});

/**
 * Tests the effects that the never-translate-sites menuitem has on
 * subsequent page loads when always-translate-language is active.
 */
add_task(async function test_page_loads_with_never_translate_site() {
  const { cleanup, runInPage } = await loadTestPage({
    page: spanishPageUrlDotCom,
    languagePairs,
  });

  await assertTranslationsButton(
    button => !button.hidden,
    "The translations button should be visible"
  );

  // The document language "es" is not in the alwaysTranslateLanguages pref,
  // so the page should be untranslated, in its original form.
  await runInPage(async TranslationsTest => {
    const { getH1 } = TranslationsTest.getSelectors();
    await TranslationsTest.assertTranslationResult(
      "The page's H1 is in Spanish.",
      getH1,
      "Don Quijote de La Mancha"
    );
  });

  // Disallow translations for this site
  await denyTranslationsPermissionForSite(spanishPageUrlDotCom);

  // Reload the page
  await navigate(spanishPageUrlDotCom);

  await assertTranslationsButton(
    button => button.hidden,
    "The translations button should be invisible"
  );

  // The page should no longer automatically translated because the site
  // no longer has permissions to be translated.
  await runInPage(async TranslationsTest => {
    const { getH1 } = TranslationsTest.getSelectors();
    await TranslationsTest.assertTranslationResult(
      "The page's H1 is in Spanish.",
      getH1,
      "Don Quijote de La Mancha"
    );
  });

  // Go to another page from the same site principal
  await navigate(spanishPageUrlDotCom2);

  await assertTranslationsButton(
    button => button.hidden,
    "The translations button should be invisible"
  );

  // This page should also be untranslated because the entire site
  // no longer has permissions to be translated.
  await runInPage(async TranslationsTest => {
    const { getH1 } = TranslationsTest.getSelectors();
    await TranslationsTest.assertTranslationResult(
      "The page's H1 is in Spanish.",
      getH1,
      "Don Quijote de La Mancha"
    );
  });

  // Go to another page from another site principal
  await navigate(spanishPageUrlDotOrg);

  await assertTranslationsButton(
    button => !button.hidden,
    "The translations button should be visible"
  );

  // This page should be untranslated because there are no auto-translate
  // preferences set in this test.
  await runInPage(async TranslationsTest => {
    const { getH1 } = TranslationsTest.getSelectors();
    await TranslationsTest.assertTranslationResult(
      "The page's H1 is in Spanish.",
      getH1,
      "Don Quijote de La Mancha"
    );
  });

  await cleanup();
});

/**
 * Tests the effects that the never-translate-sites menuitem has on
 * subsequent page loads when always-translate-language is active.
 */
add_task(
  async function test_page_loads_with_always_translate_language_and_never_translate_site() {
    const { cleanup, runInPage } = await loadTestPage({
      page: spanishPageUrlDotCom,
      languagePairs,
      prefs: [["browser.translations.alwaysTranslateLanguages", "es"]],
    });

    await assertTranslationsButton(
      button => !button.hidden,
      "The translations button should be visible"
    );

    // The page should be automatically translated because the document language
    // should be in the alwaysTranslateLanguages
    await runInPage(async TranslationsTest => {
      const { getH1 } = TranslationsTest.getSelectors();
      await TranslationsTest.assertTranslationResult(
        "The page's H1 is translated automatically",
        getH1,
        "DON QUIJOTE DE LA MANCHA [es to en, html]"
      );
    });

    // Disallow translations for this site
    await denyTranslationsPermissionForSite(spanishPageUrlDotCom);

    // Reload the page
    await navigate(spanishPageUrlDotCom);

    await assertTranslationsButton(
      button => button.hidden,
      "The translations button should be invisible"
    );

    // The page should no longer automatically translated because the site
    // no longer has permissions to be translated.
    await runInPage(async TranslationsTest => {
      const { getH1 } = TranslationsTest.getSelectors();
      await TranslationsTest.assertTranslationResult(
        "The page's H1 is in Spanish.",
        getH1,
        "Don Quijote de La Mancha"
      );
    });

    // Go to another page from the same site principal
    await navigate(spanishPageUrlDotCom2);

    await assertTranslationsButton(
      button => button.hidden,
      "The translations button should be invisible"
    );

    // This page should also be untranslated because the entire site
    // no longer has permissions to be translated.
    await runInPage(async TranslationsTest => {
      const { getH1 } = TranslationsTest.getSelectors();
      await TranslationsTest.assertTranslationResult(
        "The page's H1 is in Spanish.",
        getH1,
        "Don Quijote de La Mancha"
      );
    });

    // Go to another page from a different site principal
    await navigate(spanishPageUrlDotOrg);

    await assertTranslationsButton(
      button => !button.hidden,
      "The translations button should be visible"
    );

    // The page should be automatically translated because the document language
    // should be in the alwaysTranslateLanguages and this is a different site principal
    await runInPage(async TranslationsTest => {
      const { getH1 } = TranslationsTest.getSelectors();
      await TranslationsTest.assertTranslationResult(
        "The page's H1 is translated automatically",
        getH1,
        "DON QUIJOTE DE LA MANCHA [es to en, html]"
      );
    });

    await cleanup();
  }
);

/**
 * Tests toggling the always-translate-language and never-translate-language
 * menuitems to ensure that they interact correctly with each other and update
 * the translations menu UI accordingly.
 */
add_task(async function test_toggling_translate_language_menuitems() {
  const { cleanup } = await loadTestPage({
    page: spanishPageUrlDotCom,
    languagePairs,
    prefs: [
      ["browser.translations.alwaysTranslateLanguages", ""],
      ["browser.translations.neverTranslateLanguages", ""],
    ],
  });

  async function assertIsAlwaysTranslateLanguage(expected) {
    await assertCheckboxState(
      expected,
      "translations-panel-settings-always-translate-language"
    );
    is(TranslationsParent.shouldAlwaysTranslateLanguage("es"), expected);
  }

  async function assertIsNeverTranslateLanguage(expected) {
    await assertCheckboxState(
      expected,
      "translations-panel-settings-never-translate-language"
    );
    is(TranslationsParent.shouldNeverTranslateLanguage("es"), expected);
  }

  await openPreferencesMenu();

  await assertIsAlwaysTranslateLanguage(false);
  await assertIsNeverTranslateLanguage(false);

  // Simulate clicking always-translate-language in the preferences menu,
  // adding the document language from the alwaysTranslateLanguages pref.
  await toggleAlwaysTranslateLanguage();
  await assertIsAlwaysTranslateLanguage(true);
  await assertIsNeverTranslateLanguage(false);

  // Simulate clicking always-translate-language in the preferences menu,
  // removing the document language from the alwaysTranslateLanguages pref.
  await toggleAlwaysTranslateLanguage();
  await assertIsAlwaysTranslateLanguage(false);
  await assertIsNeverTranslateLanguage(false);

  // Simulate clicking never-translate-language in the preferences menu,
  // adding the document language from the neverTranslateLanguages pref.
  await toggleNeverTranslateLanguage();
  await assertIsAlwaysTranslateLanguage(false);
  await assertIsNeverTranslateLanguage(true);

  // Simulate clicking never-translate-language in the preferences menu,
  // removing the document language from the neverTranslateLanguages pref.
  await toggleNeverTranslateLanguage();
  await assertIsAlwaysTranslateLanguage(false);
  await assertIsNeverTranslateLanguage(false);

  // Simulate clicking always-translate-language in the preferences menu,
  // adding the document language from the alwaysTranslateLanguages pref.
  await toggleAlwaysTranslateLanguage();
  await assertIsAlwaysTranslateLanguage(true);
  await assertIsNeverTranslateLanguage(false);

  // Simulate clicking never-translate-language in the preferences menu,
  // adding the document language from the neverTranslateLanguages pref
  // and removing the language from the alwaysTranslateLanguages pref
  await toggleNeverTranslateLanguage();
  await assertIsAlwaysTranslateLanguage(false);
  await assertIsNeverTranslateLanguage(true);

  // Simulate clicking always-translate-language in the preferences menu,
  // adding the document language from the alwaysTranslateLanguages pref
  // and removing the language from the neverTranslateLanguages pref
  await toggleNeverTranslateLanguage();
  await assertIsAlwaysTranslateLanguage(false);
  await assertIsNeverTranslateLanguage(false);

  await cleanup();
});

/**
 * Tests toggling the always-translate-site menuitem to ensure that it
 * interacts correctly with the translations menu UI.
 */
add_task(async function test_toggling_translate_site_menuitem() {
  const { cleanup } = await loadTestPage({
    page: spanishPageUrlDotCom,
    languagePairs,
  });

  const translationsActor = gBrowser.selectedBrowser.browsingContext.currentWindowGlobal.getActor(
    "Translations"
  );

  async function assertIsNeverTranslateSite(expected) {
    await assertCheckboxState(
      expected,
      "translations-panel-settings-never-translate-site"
    );
    is(
      await translationsActor.shouldNeverTranslateSite(spanishPageUrlDotCom),
      expected
    );
  }

  await openPreferencesMenu();
  await assertIsNeverTranslateSite(false);

  // Simulate clicking never-translate-site in the preferences menu,
  // denying this site permission to be translated.
  await toggleNeverTranslateSite();
  await assertIsNeverTranslateSite(true);

  // Simulate clicking never-translate-site in the preferences menu,
  // re-allowing this site permission to be translated.
  await toggleNeverTranslateSite();
  await assertIsNeverTranslateSite(false);

  await cleanup();
});
