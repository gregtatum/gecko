/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { TelemetryTestUtils } = ChromeUtils.import(
  "resource://testing-common/TelemetryTestUtils.jsm"
);

let currentPage = 0;
const ONBOARDING_CARDS = [
  "Welcome",
  "Connect Account",
  "Account Connected",
  "Privacy Policy",
  "Data Preferences",
  "Ready to Go",
];
const ONBOARDING_COMPLETE_PREF = "browser.pinebuild.onboarding.complete";
const ONBOARDING_PROGRESS_PREF = "browser.pinebuild.onboarding.progress";
let win;
let browser;

async function checkForNextButton(dataAction) {
  await SpecialPowers.spawn(
    browser,
    [currentPage, ONBOARDING_CARDS, dataAction],
    async (current, onboardingCards, selector) => {
      await ContentTaskUtils.waitForCondition(() => {
        let nextButton = content.document.querySelector(
          `[data-card-name='${onboardingCards[current]}'] [data-action='${selector}']`
        );
        return nextButton;
      }, "Next button is shown");
    }
  );
}

async function navigateToNextPage(dataAction) {
  await BrowserTestUtils.synthesizeMouseAtCenter(
    `[data-card-name='${ONBOARDING_CARDS[currentPage]}'] [data-action=${dataAction}]`,
    {},
    browser
  );
  currentPage++;
}

function assertGleanEvents() {
  function assertEvent(expected, actual) {
    // Assert on the fields we care about, ignoring `actual.timestamp`.
    Assert.equal(expected.category, actual.category);
    Assert.equal(expected.name, actual.name);
    Assert.deepEqual(expected.extra, actual.extra);
  }

  assertEvent(
    {
      category: "pinebuild",
      name: "onboarding_shown_welcome",
      extra: {
        order: "0",
        is_last: "false",
      },
    },
    Glean.pinebuild.onboardingShownWelcome.testGetValue()[0]
  );
  assertEvent(
    {
      category: "pinebuild",
      name: "onboarding_done_welcome",
      extra: {
        order: "0",
        is_last: "false",
      },
    },
    Glean.pinebuild.onboardingDoneWelcome.testGetValue()[0]
  );

  assertEvent(
    {
      category: "pinebuild",
      name: "onboarding_shown_connect_fxa",
      extra: {
        order: "1",
        is_last: "false",
      },
    },
    Glean.pinebuild.onboardingShownConnectFxa.testGetValue()[0]
  );
  assertEvent(
    {
      category: "pinebuild",
      name: "onboarding_done_connect_fxa",
      extra: {
        order: "1",
        is_last: "false",
      },
    },
    Glean.pinebuild.onboardingDoneConnectFxa.testGetValue()[0]
  );

  assertEvent(
    {
      category: "pinebuild",
      name: "onboarding_shown_fxa_connected",
      extra: {
        order: "2",
        is_last: "false",
      },
    },
    Glean.pinebuild.onboardingShownFxaConnected.testGetValue()[0]
  );
  assertEvent(
    {
      category: "pinebuild",
      name: "onboarding_done_fxa_connected",
      extra: {
        order: "2",
        is_last: "false",
      },
    },
    Glean.pinebuild.onboardingDoneFxaConnected.testGetValue()[0]
  );

  assertEvent(
    {
      category: "pinebuild",
      name: "onboarding_shown_privacy",
      extra: {
        order: "3",
        is_last: "false",
      },
    },
    Glean.pinebuild.onboardingShownPrivacy.testGetValue()[0]
  );
  assertEvent(
    {
      category: "pinebuild",
      name: "onboarding_done_privacy",
      extra: {
        order: "3",
        is_last: "false",
      },
    },
    Glean.pinebuild.onboardingDonePrivacy.testGetValue()[0]
  );

  assertEvent(
    {
      category: "pinebuild",
      name: "onboarding_shown_data_prefs",
      extra: {
        order: "4",
        is_last: "false",
      },
    },
    Glean.pinebuild.onboardingShownDataPrefs.testGetValue()[0]
  );
  assertEvent(
    {
      category: "pinebuild",
      name: "onboarding_done_data_prefs",
      extra: {
        order: "4",
        is_last: "false",
      },
    },
    Glean.pinebuild.onboardingDoneDataPrefs.testGetValue()[0]
  );

  assertEvent(
    {
      category: "pinebuild",
      name: "onboarding_shown_congrats",
      extra: {
        order: "5",
        is_last: "true",
      },
    },
    Glean.pinebuild.onboardingShownCongrats.testGetValue()[0]
  );
  assertEvent(
    {
      category: "pinebuild",
      name: "onboarding_done_congrats",
      extra: {
        order: "5",
        is_last: "true",
      },
    },
    Glean.pinebuild.onboardingDoneCongrats.testGetValue()[0]
  );
}

function assertTelemetryEvents() {
  TelemetryTestUtils.assertEvents(
    [
      {
        object: "welcome",
        value: null,
        extra: { order: "0", is_last: "false" },
      },
      {
        object: "connect_fxa",
        value: null,
        extra: { order: "1", is_last: "false" },
      },
      {
        object: "fxa_connected",
        value: null,
        extra: { order: "2", is_last: "false" },
      },
      {
        object: "privacy",
        value: null,
        extra: { order: "3", is_last: "false" },
      },
      {
        object: "data_prefs",
        value: null,
        extra: { order: "4", is_last: "false" },
      },
      {
        object: "congrats",
        value: null,
        extra: { order: "5", is_last: "true" },
      },
    ],
    {
      category: "pinebuild.onboarding",
      method: "shown",
    },
    { clear: false }
  );

  TelemetryTestUtils.assertEvents(
    [
      {
        object: "welcome",
        value: null,
        extra: { order: "0", is_last: "false" },
      },
      {
        object: "connect_fxa",
        value: null,
        extra: { order: "1", is_last: "false" },
      },
      {
        object: "fxa_connected",
        value: null,
        extra: { order: "2", is_last: "false" },
      },
      {
        object: "privacy",
        value: null,
        extra: { order: "3", is_last: "false" },
      },
      {
        object: "data_prefs",
        value: null,
        extra: { order: "4", is_last: "false" },
      },
      {
        object: "congrats",
        value: null,
        extra: { order: "5", is_last: "true" },
      },
    ],
    {
      category: "pinebuild.onboarding",
      method: "done",
    },
    { clear: false }
  );
}

add_setup(async () => {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["identity.fxaccounts.allowHttp", true],
      ["identity.fxaccounts.remote.root", "http://example.com/"],
    ],
  });

  Services.telemetry.clearEvents();
  Services.telemetry.setEventRecordingEnabled("pinebuild.onboarding", true);
  registerCleanupFunction(async () => {
    Services.telemetry.setEventRecordingEnabled("pinebuild.onboarding", false);
  });
  Services.fog.testResetFOG();
});

add_task(async function test_onboarding_to_fxa() {
  await SpecialPowers.pushPrefEnv({
    set: [[ONBOARDING_COMPLETE_PREF, false]],
  });
  await SpecialPowers.pushPrefEnv({
    set: [[ONBOARDING_PROGRESS_PREF, currentPage]],
  });
  // Run test in a new window to avoid affecting the main test window.
  win = await BrowserTestUtils.openNewBrowserWindow();

  browser = win.gBrowser.selectedBrowser;
  BrowserTestUtils.loadURI(browser, "about:onboarding");
  await BrowserTestUtils.browserLoaded(browser, false, "about:onboarding");
  await checkForNextButton("navigate-forward");
  await navigateToNextPage("navigate-forward");
  is(
    Services.prefs.getIntPref(ONBOARDING_PROGRESS_PREF),
    currentPage,
    "Reached page 2 of onboarding"
  );
  // We expect this next step to open up the OAuthConnect tab
  let loadPromise = BrowserTestUtils.waitForNewTab(win.gBrowser, null, true);
  await checkForNextButton("initiate-fxa-flow");
  await navigateToNextPage("initiate-fxa-flow");
  let oauthTab = await loadPromise;

  // Compute the redirect URL that the OAuth module expects, and send the browser
  // there, to pretend that the user completed the sign-in. This will automatically
  // cause the underlying OAuth tab to close, which we wait for.
  let state = new URLSearchParams(oauthTab.linkedBrowser.currentURI.spec).get(
    "state"
  );
  let redirectURL = await win.FxAccounts.config.promisePairingURI({ state });
  let tabClose = BrowserTestUtils.waitForTabClosing(oauthTab);
  BrowserTestUtils.loadURI(win.gBrowser.selectedBrowser, redirectURL);
  await tabClose;

  await BrowserTestUtils.closeWindow(win);
});

add_task(async function test_onboarding_fxa_to_complete() {
  // Start on page 3 of Onboarding after bypassing Fxa
  await SpecialPowers.pushPrefEnv({
    set: [[ONBOARDING_COMPLETE_PREF, false]],
  });
  await SpecialPowers.pushPrefEnv({
    set: [[ONBOARDING_PROGRESS_PREF, currentPage]],
  });
  // Run test in a new window to avoid affecting the main test window.
  win = await BrowserTestUtils.openNewBrowserWindow();
  browser = win.gBrowser.selectedBrowser;
  BrowserTestUtils.loadURI(browser, "about:onboarding");
  await BrowserTestUtils.browserLoaded(browser, false, "about:onboarding");
  let helper = new CompanionHelper(win);
  await helper.closeCompanion();
  info("Reached page 3 of onboarding");
  await checkForNextButton("navigate-forward");
  await navigateToNextPage("navigate-forward");
  is(
    Services.prefs.getIntPref(ONBOARDING_PROGRESS_PREF),
    currentPage,
    "Reached page 4 of onboarding"
  );
  await checkForNextButton("navigate-forward");
  await navigateToNextPage("navigate-forward");
  is(
    Services.prefs.getIntPref(ONBOARDING_PROGRESS_PREF),
    currentPage,
    "Reached page 5 of onboarding"
  );
  await checkForNextButton("navigate-forward");
  await navigateToNextPage("navigate-forward");
  is(
    Services.prefs.getIntPref(ONBOARDING_PROGRESS_PREF),
    currentPage,
    "Reached page 6 of onboarding"
  );
  await checkForNextButton("complete-onboarding");
  await navigateToNextPage("complete-onboarding");
  is(
    Services.prefs.getBoolPref(ONBOARDING_COMPLETE_PREF),
    true,
    "Onboarding is complete"
  );

  assertGleanEvents();
  assertTelemetryEvents();

  await BrowserTestUtils.closeWindow(win);
});
