"use strict";

const { getAddonAndLocalAPIsMocker } = ChromeUtils.import(
  "resource://testing-common/LangPackMatcherTestUtils.jsm"
);

requestLongerTimeout(1000);
const sandbox = sinon.createSandbox();
const mockAddonAndLocaleAPIs = getAddonAndLocalAPIsMocker(this, sandbox);
add_task(function initSandbox() {
  registerCleanupFunction(() => {
    sandbox.restore();
  });
});

/**
 * Spy specifically on the button click telemetry.
 *
 * The returned function flushes the spy of all of the matching button click events, and
 * returns the events.
 * @returns {() => TelemetryEvents[]}
 */
async function spyOnTelemetryButtonClicks(browser) {
  let aboutWelcomeActor = await getAboutWelcomeParent(browser);
  sandbox.spy(aboutWelcomeActor, "onContentMessage");
  return () => {
    const result = aboutWelcomeActor.onContentMessage
      .getCalls()
      .filter(
        call =>
          call.args[0] === "AWPage:TELEMETRY_EVENT" &&
          call.args[1]?.event === "CLICK_BUTTON"
      )
      // The second argument is the telemetry event.
      .map(call => call.args[1]);

    aboutWelcomeActor.onContentMessage.resetHistory();
    return result;
  };
}

async function openAboutWelcome(templateMR = false) {
  await pushPrefs(
    // Speed up the tests by disabling transitions.
    ["browser.aboutwelcome.templateMR", templateMR],
    ["browser.aboutwelcome.transitions", false],
    ["intl.multilingual.aboutWelcome.languageMismatchEnabled", true]
  );
  await setAboutWelcomePref(true);

  // Stub out the doesAppNeedPin to false so the about:welcome pages do not attempt
  // to pin the app.
  const { ShellService } = ChromeUtils.import(
    "resource:///modules/ShellService.jsm"
  );
  sandbox.stub(ShellService, "doesAppNeedPin").returns(false);

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
    flushClickTelemetry: await spyOnTelemetryButtonClicks(tab.linkedBrowser),
  };
}

async function clickVisibleButton(browser, selector) {
  // eslint-disable-next-line no-shadow
  await ContentTask.spawn(browser, { selector }, async ({ selector }) => {
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
      selector,
      200, // interval
      100 // maxTries
    );
    getVisibleElement().click();
  });
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
        const els = content.document.querySelectorAll(selector);
        // The offsetParent will be null if element is hidden through "display: none;"
        return [...els].some(el => el.offsetParent !== null);
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
 * Report telemetry mismatches nicely.
 */
function eventsMatch(
  actualEvents,
  expectedEvents,
  message = "Telemetry events match"
) {
  if (actualEvents.length !== expectedEvents.length) {
    console.error("Events do not match");
    console.error("Actual: ", JSON.stringify(actualEvents, null, 2));
    console.error("Expected: ", JSON.stringify(expectedEvents, null, 2));
  }
  for (let i = 0; i < actualEvents.length; i++) {
    const actualEvent = JSON.stringify(actualEvents[i], null, 2);
    const expectedEvent = JSON.stringify(expectedEvents[i], null, 2);
    if (actualEvent !== expectedEvent) {
      console.error("Events do not match");
      dump(`Actual: ${actualEvent}`);
      dump("\n");
      dump(`Expected: ${expectedEvent}`);
      dump("\n");
    }
    ok(actualEvent === expectedEvent, message);
  }
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
  sandbox.restore();
  const {
    resolveLangPacks,
    resolveInstaller,
    mockable,
  } = mockAddonAndLocaleAPIs({
    systemLocale: "es-ES",
    appLocale: "en-US",
  });

  const { browser, flushClickTelemetry } = await openAboutWelcome();

  info("Clicking the primary button to start the onboarding process.");
  await clickVisibleButton(browser, `button.primary[value="primary_button"]`);

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

  // Ignore the telemetry of the initial welcome screen.
  flushClickTelemetry();

  resolveLangPacks(["es-MX", "es-ES", "fr-FR"]);

  await testScreenContent(
    browser,
    "Live language switching, asking for a language",
    // Expected selectors:
    [
      ...liveLanguageSwitchSelectors,
      `button.primary[value="primary_button"]`,
      `button.primary[value="decline"]`,
    ],
    // Unexpected selectors:
    [
      `button[disabled] [data-l10n-id="onboarding-live-language-waiting-button"]`,
      `[data-l10n-id="onboarding-live-language-skip-button-label"]`,
    ]
  );

  info("Clicking the primary button to view language switching page.");
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
  
  await new Promise(resolve => setTimeout(resolve, 500000));

  eventsMatch(flushClickTelemetry(), [
    {
      event: "CLICK_BUTTON",
      event_context: {
        source: "download_langpack",
        page: "about:welcome",
      },
      message_id: "DEFAULT_ABOUTWELCOME_PROTON_1_AW_LANGUAGE_MISMATCH",
    },
  ]);

  sinon.assert.notCalled(mockable.setRequestedAppLocales);

  await resolveInstaller();

  await testScreenContent(
    browser,
    "Language changed",
    // Expected selectors:
    [`.screen-2`],
    // Unexpected selectors:
    liveLanguageSwitchSelectors
  );

  info("The app locale was changed to the OS locale.");
  sinon.assert.calledWith(mockable.setRequestedAppLocales, ["es-ES", "en-US"]);

  eventsMatch(flushClickTelemetry(), [
    {
      event: "CLICK_BUTTON",
      event_context: {
        source: "download_complete",
        page: "about:welcome",
      },
      message_id: "DEFAULT_ABOUTWELCOME_PROTON_1_AW_LANGUAGE_MISMATCH",
    },
  ]);
});
