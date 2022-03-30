/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

registerCleanupFunction(async () => {
  // No matter what happens, blow away window history after this file runs
  // to avoid leaking state between tests.
  gStageManager.reset();
});

add_setup(async function setup() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["browser.pinebuild.companion-service-onboarding.enabled", true],
      [
        "browser.pinebuild.companion.test-services",
        JSON.stringify([
          {
            icon: "chrome://browser/content/companion/googleAccount.png",
            name: "Test service",
            services: "Test calendar things",
            domains: ["example.net"],
            type: "testservice",
            api: "testservice",
          },
        ]),
      ],
    ],
  });
});

async function assertConnectCard(helper, _opts) {
  await helper.runCompanionTask(
    async opts => {
      let servicesOnboarding = content.document.querySelector(
        "services-onboarding"
      );

      if (opts.service) {
        if (opts.recentlyAuthed) {
          ok(
            servicesOnboarding.recentlyAuthedServices.has(opts.service),
            "Service is recently authed"
          );
        } else {
          is(
            servicesOnboarding.currentService,
            opts.service,
            "Service is current"
          );
        }
      } else {
        ok(!servicesOnboarding.currentService, "No connect to service shown");
      }

      is(
        servicesOnboarding.connectServiceNotifications.length,
        opts.length,
        `${opts.length} connect-service-notification elements are shown`
      );

      if (opts.length == 1) {
        let connectService = servicesOnboarding.connectServiceNotifications[0];
        is(
          connectService.type,
          opts.service,
          "The connect card is for the test service"
        );
        is(
          connectService.connected,
          opts.connected,
          "The connect card has the right connected state"
        );
        is(
          connectService.authenticating,
          !!opts.authenticating,
          "The connect card has the correct authenticating state"
        );
        is(
          connectService.connectButton.hasAttribute("disabled"),
          !!opts.authenticating,
          "The connect button has the correct disable state"
        );

        if (opts.clickConnect) {
          connectService.connectButton.click();
        } else if (opts.hideService) {
          servicesOnboarding.hideService(opts.service);
        }
      }
    },
    [_opts]
  );
}

async function waitForDomainHandled(helper, domain) {
  await helper.runCompanionTask(
    async _domain => {
      let servicesOnboarding = content.document.querySelector(
        "services-onboarding"
      );

      await ContentTaskUtils.waitForEvent(
        servicesOnboarding,
        "service-onboarding-url-handled",
        e => e.detail.domain == _domain
      );
    },
    [domain]
  );
}

async function loadURI(gBrowser, url) {
  let browser = gBrowser.selectedBrowser;
  let newViewCreated = PinebuildTestUtils.waitForNewView(browser, url);
  BrowserTestUtils.loadURI(browser, url);
  await newViewCreated;
}

async function clickLoginLink(browser) {
  await SpecialPowers.spawn(browser, [], async () => {
    let link = await ContentTaskUtils.waitForCondition(() =>
      content.document.querySelector("a")
    );
    link.click();
  });
}

add_task(async function testConnectOptionNotShown() {
  await PinebuildTestUtils.withNewBrowserWindow(async win => {
    const { gBrowser } = win;

    await CompanionHelper.whenReady(async helper => {
      let testUrl = "https://test1.example.com/";
      let domain = "test1.example.com";

      let urlHandled = waitForDomainHandled(helper, domain);

      await loadURI(gBrowser, testUrl);
      await urlHandled;

      await assertConnectCard(helper, { length: 0 });
    }, win);
  });
});

add_task(async function testConnectOptionShown() {
  await PinebuildTestUtils.withNewBrowserWindow(async win => {
    const { gBrowser } = win;

    await CompanionHelper.whenReady(async helper => {
      let testUrl = "https://example.net/";
      let domain = "example.net";

      await assertConnectCard(helper, { length: 0 });

      let urlHandled = waitForDomainHandled(helper, domain);

      await loadURI(gBrowser, testUrl);
      await urlHandled;

      let authStarted = BrowserTestUtils.waitForNewTab(gBrowser);
      let connected = TestUtils.topicObserved(
        "companion-signin",
        (_, data) => data == "testservice"
      );

      await assertConnectCard(helper, {
        service: "testservice",
        length: 1,
        connected: false,
        clickConnect: true,
      });

      await authStarted;
      await assertConnectCard(helper, {
        service: "testservice",
        length: 1,
        connected: false,
        authenticating: true,
      });
      await clickLoginLink(gBrowser.selectedBrowser);

      await connected;
      await assertConnectCard(helper, {
        service: "testservice",
        length: 1,
        connected: true,
        recentlyAuthed: true,
        hideService: true,
      });

      await helper.logoutFromTestService("testservice");
    }, win);
  });
});

add_task(async function testDuplicateServiceTypeHidden() {
  await PinebuildTestUtils.withNewBrowserWindow(async win => {
    const { gBrowser } = win;

    await CompanionHelper.whenReady(async helper => {
      await assertConnectCard(helper, { length: 0 });
      await helper.loginToTestService("testservice");
      await assertConnectCard(helper, {
        service: "testservice",
        length: 1,
        connected: true,
        recentlyAuthed: true,
        hideService: true,
      });
      await assertConnectCard(helper, { length: 0 });

      let testUrl = "https://example.net/";
      let domain = "example.net";

      let urlHandled = waitForDomainHandled(helper, domain);

      await loadURI(gBrowser, testUrl);
      await urlHandled;
      await assertConnectCard(helper, {
        service: "testservice",
        length: 0,
      });
      await helper.logoutFromTestService("testservice");
    }, win);
  });
});

add_task(async function testOauthFlow() {
  await PinebuildTestUtils.withNewBrowserWindow(async win => {
    const { gBrowser } = win;

    await CompanionHelper.whenReady(async helper => {
      let testUrl = "https://example.net/";
      let domain = "example.net";

      await assertConnectCard(helper, { length: 0 });

      let urlHandled = waitForDomainHandled(helper, domain);

      await loadURI(gBrowser, testUrl);
      await urlHandled;

      let authStarted = BrowserTestUtils.waitForNewTab(gBrowser);

      await assertConnectCard(helper, {
        service: "testservice",
        length: 1,
        connected: false,
        authenticating: false,
        clickConnect: true,
      });

      await authStarted;

      await assertConnectCard(helper, {
        service: "testservice",
        length: 1,
        connected: false,
        authenticating: true,
        hideService: true,
      });
      gBrowser.removeTab(gBrowser.selectedTab);
    }, win);
  });
});

add_task(async function testMultipleOauthFlow() {
  await PinebuildTestUtils.withNewBrowserWindow(async win => {
    const { gBrowser } = win;

    await CompanionHelper.whenReady(async helper => {
      let testUrl = "https://example.net/";
      let domain = "example.net";

      await assertConnectCard(helper, { length: 0 });

      let urlHandled = waitForDomainHandled(helper, domain);

      await loadURI(gBrowser, testUrl);
      await urlHandled;

      let exampleTab = gBrowser.selectedTab;
      let initialTabCount = gBrowser.tabs.length;
      let authStarted = BrowserTestUtils.waitForNewTab(gBrowser);

      await assertConnectCard(helper, {
        service: "testservice",
        length: 1,
        connected: false,
        authenticating: false,
        clickConnect: true,
      });

      await authStarted;

      await assertConnectCard(helper, {
        service: "testservice",
        length: 1,
        connected: false,
        authenticating: true,
        hideService: true,
      });

      gBrowser.selectedTab = exampleTab;
      let authStartedAgain = BrowserTestUtils.waitForNewTab(gBrowser);

      await assertConnectCard(helper, {
        service: "testservice",
        length: 1,
        connected: false,
        authenticating: false,
        clickConnect: true,
      });
      await authStartedAgain;

      is(gBrowser.tabs.length, initialTabCount + 2, "Two OAuth tabs created");

      await assertConnectCard(helper, {
        service: "testservice",
        length: 1,
        connected: false,
        authenticating: true,
      });

      let authenticated = TestUtils.topicObserved(
        "companion-signin",
        (_, data) => data == "testservice"
      );

      const delayPref = "pinebuild.testing.OAuthDelayAccessToken";
      Services.prefs.setBoolPref(delayPref, true);

      let tabClosed = BrowserTestUtils.waitForTabClosing(gBrowser.selectedTab);

      await clickLoginLink(gBrowser.selectedBrowser);

      await tabClosed;
      await assertConnectCard(helper, {
        service: "testservice",
        length: 1,
        connected: false,
        authenticating: true,
      });

      Services.prefs.clearUserPref(delayPref);
      await authenticated;

      is(gBrowser.tabs.length, initialTabCount, "OAuth tabs have been removed");

      await helper.logoutFromTestService("testservice");
    }, win);
  });
});

add_task(async function testOauthFlowError() {
  await PinebuildTestUtils.withNewBrowserWindow(async win => {
    const { gBrowser } = win;

    await CompanionHelper.whenReady(async helper => {
      let testUrl = "https://example.net/";
      let domain = "example.net";

      await assertConnectCard(helper, { length: 0 });

      let urlHandled = waitForDomainHandled(helper, domain);

      await loadURI(gBrowser, testUrl);
      await urlHandled;

      let authStarted = BrowserTestUtils.waitForNewTab(gBrowser);

      await assertConnectCard(helper, {
        service: "testservice",
        length: 1,
        connected: false,
        authenticating: false,
        clickConnect: true,
      });

      await authStarted;

      await assertConnectCard(helper, {
        service: "testservice",
        length: 1,
        connected: false,
        authenticating: true,
        hideService: true,
      });

      await assertConnectCard(helper, {
        service: "testservice",
        length: 1,
        connected: false,
        authenticating: true,
      });

      const errorPref = "pinebuild.testing.OAuthErrorAccessToken";
      Services.prefs.setBoolPref(errorPref, true);

      let tabClosed = BrowserTestUtils.waitForTabClosing(gBrowser.selectedTab);

      await clickLoginLink(gBrowser.selectedBrowser);
      await tabClosed;
      await assertConnectCard(helper, {
        service: "testservice",
        length: 1,
        connected: false,
        authenticating: false,
      });

      Services.prefs.clearUserPref(errorPref);
    }, win);
  });
});
