"use strict";

let sandbox;
add_task(function initSandbox() {
  sandbox = sinon.createSandbox();
  registerCleanupFunction(() => {
    sandbox.restore();
  });
});

async function openAboutWelcome() {
  await pushPrefs([
    "intl.multilingual.aboutWelcome.languageMismatchEnabled",
    true,
  ]);
  await setAboutWelcomePref(true);

  info("Opening about:welcome");
  let tab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "about:welcome",
    true
  );

  // With registerCleanupFunction the tabs will accumulate until the end of the entire
  // test suite, not the end of the task run.
  registerCleanupFunction(() => {
    BrowserTestUtils.removeTab(tab);
  });
  return tab.linkedBrowser;
}

/**
 * LangPackMatcher.jsm calls out to to the addons store, which involves network requests.
 * Other tests create a fake addons server, and install mock XPIs. At the time of this
 * writing that infrastructure is not available for mochitests.
 *
 * Instead, this test mocks out APIs that have a side-effect, so the addons of the browser
 * are never modified.
 *
 * The calls to get the app's locale and system's locale are also mocked so that the
 * different language mismatch scenarios can be run through.
 */
function mockAddonAndLocaleAPIs({ systemLocale, appLocale }) {
  info("Mocking LangPackMatcher.jsm APIs");

  // Reset any previous mocks for a fresh start.
  sandbox.restore();

  let resolveLangPacks;
  const langPackPromise = new Promise(resolve => {
    resolveLangPacks = availableLangpacks => {
      info(
        `Resolving which langpacks are available for download: ${JSON.stringify(
          availableLangpacks
        )}`
      );
      resolve(
        availableLangpacks.map(locale => ({
          guid: `langpack-${locale}@firefox.mozilla.org`,
          type: "language",
          target_locale: locale,
          current_compatible_version: {
            files: [
              {
                platform: "all",
                url: `http://example.com/${locale}.langpack.xpi`,
              },
            ],
          },
        }))
      );
    };
  });

  let resolveInstaller;
  const installerPromise = new Promise(resolve => {
    resolveInstaller = () => {
      info("LangPack install finished.")
      resolve();
    }
  });

  const { LangPackMatcher } = ChromeUtils.import(
    "resource://gre/modules/LangPackMatcher.jsm"
  );
  const { mockable } = LangPackMatcher;
  sandbox.stub(mockable, "getAvailableLocales").returns([appLocale]);
  sandbox.stub(mockable, "getAppLocaleAsBCP47").returns(appLocale);
  sandbox.stub(mockable, "getSystemLocale").returns(systemLocale);

  sandbox.stub(mockable, "getAvailableLangpacks").callsFake(() => {
    info("Requesting which langpacks are available for download");
    return langPackPromise;
  });

  sandbox.stub(mockable, "installLangPack").callsFake(langPack => {
    info(
      `LangPack install started, but pending: ${JSON.stringify(
        langPack,
        null,
        2
      )}`
    );
    return installerPromise;
  });

  sandbox.stub(mockable, "setRequestedAppLocales").callsFake(locales => {
    info(`Changing the browser's requested locales to: ${JSON.stringify(locales)}`);
  });

  return {
    /**
     * Resolves the addons API call with available langpacks. Call with a list
     * of BCP 47 identifiers.
     *
     * @type {(availableLangpacks: string[]) => {}}
     */
    resolveLangPacks,

    /**
     * Resolves the pending call to install a langpack.
     *
     * @type {() => {}}
     */
    resolveInstaller,
  };
}

const liveLanguageSwitchSelectors = [
  ".screen-1",
  `[data-l10n-id*="onboarding-live-language"]`,
  `[data-l10n-id="onboarding-live-language-header"]`,
];


/**
 * Accept the about:welcome offer to change the Firefox language when
 * there is a mismatch between the operating system language and the Firefox
 * language.
 */
add_task(async function test_aboutwelcome_languageSwitcher_accept() {
  const { resolveLangPacks, resolveInstaller } = mockAddonAndLocaleAPIs({
    systemLocale: "es-ES",
    appLocale: "en-US",
  });

  let browser = await openAboutWelcome();

  info("Clicking the primary button to start the onboarding process.");
  await onButtonClick(browser, "button.primary");

  await test_screen_content(
    browser,
    "Live language switching (waiting for languages)",
    // Expected selectors:
    [
      ...liveLanguageSwitchSelectors,
      `[data-l10n-id="onboarding-live-language-header"]`,
      `[data-l10n-id="onboarding-live-language-waiting-button"][disabled]`,
      `[data-l10n-id="onboarding-live-language-skip-button-label"]`,
    ],
    // Unexpected selectors:
    []
  );

  resolveLangPacks(["es-MX", "es-ES", "fr-FR"]);

  await test_screen_content(
    browser,
    "Live language switching, asking for a language",
    // Expected selectors:
    [
      ...liveLanguageSwitchSelectors,
      `[data-l10n-id="onboarding-live-language-switch-button-label"]`,
      `[data-l10n-id="onboarding-live-language-not-now-button-label"]`,
    ],
    // Unexpected selectors:
    [
      `[data-l10n-id="onboarding-live-language-waiting-button"][disabled]`,
      `[data-l10n-id="onboarding-live-language-skip-button-label"]`,
    ]
  );

  info("Clicking the primary button to start installing the langpack.");
  await onButtonClick(browser, "button.primary");

  await test_screen_content(
    browser,
    "Live language switching, waiting for langpack to download",
    // Expected selectors:
    [
      ...liveLanguageSwitchSelectors,
      `[data-l10n-id="onboarding-live-language-button-label-downloading"]`,
      `[data-l10n-id="onboarding-live-language-secondary-cancel-download"]`,
      `[data-l10n-id="onboarding-live-language-not-now-button-label"]`,
    ],
    // Unexpected selectors:
    [
      `[data-l10n-id="onboarding-live-language-waiting-button"][disabled]`,
    ]
  );

  await resolveInstaller();

  await test_screen_content(
    browser,
    "Language selection declined",
    // Expected selectors:
    [`.screen-2`],
    // Unexpected selectors:
    liveLanguageSwitchSelectors
  );
});

/**
 * Test declining the about:welcome offer to change the Firefox language when
 * there is a mismatch between the operating system language and the Firefox
 * language.
 */
add_task(async function test_aboutwelcome_languageSwitcher_decline() {
  const { resolveLangPacks } = mockAddonAndLocaleAPIs({
    systemLocale: "es-ES",
    appLocale: "en-US",
  });

  let browser = await openAboutWelcome();
  let aboutWelcomeActor = await getAboutWelcomeParent(browser);
  sandbox.spy(aboutWelcomeActor, "onContentMessage");

  info("Clicking the primary button to start installing the langpack.");
  await onButtonClick(browser, "button.primary");

  await test_screen_content(
    browser,
    "Live language switching (waiting for languages)",
    // Expected selectors:
    [
      ...liveLanguageSwitchSelectors,
      `[data-l10n-id="onboarding-live-language-header"]`,
      `[data-l10n-id="onboarding-live-language-waiting-button"][disabled]`,
      `[data-l10n-id="onboarding-live-language-skip-button-label"]`,
    ],
    // Unexpected selectors:
    []
  );

  resolveLangPacks(["es-MX", "es-ES", "fr-FR"]);

  await test_screen_content(
    browser,
    "Live language switching, asking for a language",
    // Expected selectors:
    [
      ...liveLanguageSwitchSelectors,
      `[data-l10n-id="onboarding-live-language-switch-button-label"]`,
      `[data-l10n-id="onboarding-live-language-not-now-button-label"]`,
    ],
    // Unexpected selectors:
    [
      `[data-l10n-id="onboarding-live-language-waiting-button"][disabled]`,
      `[data-l10n-id="onboarding-live-language-skip-button-label"]`,
    ]
  );

  info("Clicking the secondary button to skip installing the langpack.");
  await onButtonClick(browser, "button.secondary");

  await test_screen_content(
    browser,
    "Language selection declined",
    // Expected selectors:
    [`.screen-2`],
    // Unexpected selectors:
    liveLanguageSwitchSelectors
  );
});
