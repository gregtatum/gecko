/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

let currentPage = 0;
const ONBOARDING_CARDS = [
  "Welcome",
  "Connect Account",
  "Account Connected",
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

add_setup(async () => {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["identity.fxaccounts.allowHttp", true],
      ["identity.fxaccounts.remote.root", "http://example.com/"],
    ],
  });
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
  await checkForNextButton("complete-onboarding");
  await navigateToNextPage("complete-onboarding");
  is(
    Services.prefs.getBoolPref(ONBOARDING_COMPLETE_PREF),
    true,
    "Onboarding is complete"
  );
  await BrowserTestUtils.closeWindow(win);
});
