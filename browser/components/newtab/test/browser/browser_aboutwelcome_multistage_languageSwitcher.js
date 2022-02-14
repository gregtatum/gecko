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

  registerCleanupFunction(async () => {
    BrowserTestUtils.removeTab(tab);
  });

  return {
    browser: tab.linkedBrowser,
  };
}

async function clickVisibleButton(browser, selector) {
  await ContentTask.spawn(
    browser,
    { selector },
    async ({ selector }) => {
      function getVisibleElement() {
        for (const el of content.document.querySelectorAll(selector)) {
          if (el.offsetParent !== null) {
            return el;
          }
        }
        return null;
      }

      await ContentTaskUtils.waitForCondition(
        getVisibleElement,
        selector
      );
      getVisibleElement().click();
    }
  );
}

/**
 * Test that selectors are present and visible.
 */
async function testScreenContent(
  browser,
  name,
  expectedSelectors = [],
  unexpectedSelectors = []
) {
  await ContentTask.spawn(
    browser,
    { expectedSelectors, name, unexpectedSelectors },
    async ({
      expectedSelectors: expected,
      name: experimentName,
      unexpectedSelectors: unexpected,
    }) => {
      function selectorIsVisible(selector) {
        const el = content.document.querySelector(selector);
        // The offsetParent will be null if element is hidden through "display: none;"
        return el && el.offsetParent !== null;
      }

      for (let selector of expected) {
        await ContentTaskUtils.waitForCondition(
          () => selectorIsVisible(selector),
          `Should render ${selector} in ${experimentName}`
        );
      }
      for (let selector of unexpected) {
        ok(
          !selectorIsVisible(selector),
          `Should not render ${selector} in ${experimentName}`
        );
      }
    }
  );
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
      info("LangPack install finished.");
      resolve();
    };
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
      `LangPack install started, but pending: ${langPack.target_locale}`
    );
    return installerPromise;
  });

  sandbox.stub(mockable, "setRequestedAppLocales").callsFake(locales => {
    info(
      `Changing the browser's requested locales to: ${JSON.stringify(locales)}`
    );
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

    /**
     * The mocked APIs.
     */
    mockable,
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

  const { browser } = await openAboutWelcome();

  info("Clicking the primary button to start the onboarding process.");
  await clickVisibleButton(browser, "button.primary");

  await testScreenContent(
    browser,
    "Live language switching (waiting for languages)",
    // Expected selectors:
    [
      ...liveLanguageSwitchSelectors,
      `[data-l10n-id="onboarding-live-language-header"]`,
      `button[disabled] [data-l10n-id="onboarding-live-language-waiting-button"]`,
      `[data-l10n-id="onboarding-live-language-skip-button-label"]`,
    ],
    // Unexpected selectors:
    []
  );

  resolveLangPacks(["es-MX", "es-ES", "fr-FR"]);

  await testScreenContent(
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
      `button[disabled] [data-l10n-id="onboarding-live-language-waiting-button"]`,
      `[data-l10n-id="onboarding-live-language-skip-button-label"]`,
    ]
  );


  info("Clicking the primary button to start installing the langpack.");
  await clickVisibleButton(browser, "button.primary");

  await testScreenContent(
    browser,
    "Live language switching, waiting for langpack to download",
    // Expected selectors:
    [
      ...liveLanguageSwitchSelectors,
      `[data-l10n-id="onboarding-live-language-button-label-downloading"]`,
      `[data-l10n-id="onboarding-live-language-secondary-cancel-download"]`,
    ],
    // Unexpected selectors:
    [
      `button[disabled] [data-l10n-id="onboarding-live-language-waiting-button"]`,
    ]
  );

  await resolveInstaller();

  await testScreenContent(
    browser,
    "Language selection declined",
    // Expected selectors:
    [`.screen-2`],
    // Unexpected selectors:
    liveLanguageSwitchSelectors
  );
});

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

  const { browser } = await openAboutWelcome();

  info("Clicking the primary button to start the onboarding process.");
  await clickVisibleButton(browser, "button.primary");

  await testScreenContent(
    browser,
    "Live language switching (waiting for languages)",
    // Expected selectors:
    [
      ...liveLanguageSwitchSelectors,
      `[data-l10n-id="onboarding-live-language-header"]`,
      `button[disabled] [data-l10n-id="onboarding-live-language-waiting-button"]`,
      `[data-l10n-id="onboarding-live-language-skip-button-label"]`,
    ],
    // Unexpected selectors:
    []
  );

  resolveLangPacks(["es-MX", "es-ES", "fr-FR"]);

  await testScreenContent(
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
      `button[disabled] [data-l10n-id="onboarding-live-language-waiting-button"]`,
      `[data-l10n-id="onboarding-live-language-skip-button-label"]`,
    ]
  );

  info("Clicking the primary button to start installing the langpack.");
  await clickVisibleButton(browser, "button.primary");

  await testScreenContent(
    browser,
    "Live language switching, waiting for langpack to download",
    // Expected selectors:
    [
      ...liveLanguageSwitchSelectors,
      `[data-l10n-id="onboarding-live-language-button-label-downloading"]`,
      `[data-l10n-id="onboarding-live-language-secondary-cancel-download"]`,
    ],
    // Unexpected selectors:
    [
      `button[disabled] [data-l10n-id="onboarding-live-language-waiting-button"]`,
    ]
  );

  await resolveInstaller();

  await testScreenContent(
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
  const { resolveLangPacks, resolveInstaller } = mockAddonAndLocaleAPIs({
    systemLocale: "es-ES",
    appLocale: "en-US",
  });

  const { browser } = await openAboutWelcome();

  info("Clicking the primary button to start installing the langpack.");
  await clickVisibleButton(browser, "button.primary");

  await testScreenContent(
    browser,
    "Live language switching (waiting for languages)",
    // Expected selectors:
    [
      ...liveLanguageSwitchSelectors,
      `[data-l10n-id="onboarding-live-language-header"]`,
      `button[disabled] [data-l10n-id="onboarding-live-language-waiting-button"]`,
      `[data-l10n-id="onboarding-live-language-skip-button-label"]`,
    ],
    // Unexpected selectors:
    []
  );

  resolveLangPacks(["es-MX", "es-ES", "fr-FR"]);
  resolveInstaller()

  await testScreenContent(
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
      `button[disabled] [data-l10n-id="onboarding-live-language-waiting-button"]`,
      `[data-l10n-id="onboarding-live-language-skip-button-label"]`,
    ]
  );

  info("Clicking the secondary button to skip installing the langpack.");
  await clickVisibleButton(browser, "button.secondary");

  await testScreenContent(
    browser,
    "Language selection declined",
    // Expected selectors:
    [`.screen-2`],
    // Unexpected selectors:
    liveLanguageSwitchSelectors
  );
});

/**
 * Ensure the langpack can be installed before the user gets to the language screen.
 */
add_task(async function test_aboutwelcome_languageSwitcher_asyncCalls() {
  const {
    resolveLangPacks,
    resolveInstaller,
    mockable,
  } = mockAddonAndLocaleAPIs({
    systemLocale: "es-ES",
    appLocale: "en-US",
  });

  await openAboutWelcome();

  info("Waiting for getAvailableLangpacks to be called.");
  await TestUtils.waitForCondition(
    () => mockable.getAvailableLangpacks.called,
    "getAvailableLangpacks called once"
  );
  ok(mockable.installLangPack.notCalled);

  resolveLangPacks(["es-MX", "es-ES", "fr-FR"]);

  await TestUtils.waitForCondition(
    () => mockable.installLangPack.called,
    "installLangPack was called once"
  );
  ok(mockable.getAvailableLangpacks.called);

  resolveInstaller();
});
