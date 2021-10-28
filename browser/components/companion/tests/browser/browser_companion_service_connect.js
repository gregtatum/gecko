/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

registerCleanupFunction(async () => {
  // No matter what happens, blow away window history after this file runs
  // to avoid leaking state between tests.
  gGlobalHistory.reset();
  await PinebuildTestUtils.logoutFromTestService("testservice");
});

add_task(async function setup() {
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
            domains: ["www.example.com", "test2.example.com"],
            type: "testservice",
          },
          {
            icon: "chrome://browser/content/companion/googleAccount.png",
            name: "Test service",
            services: "Test calendar things",
            domains: ["example.net"],
            type: "testserviceauth",
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
        servicesOnboarding.connectServiceElements.length,
        opts.length,
        `${opts.length} connect-service elements are shown`
      );

      if (opts.length == 1) {
        let connectService = servicesOnboarding.connectServiceElements[0];
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
          "The connect button has the correct disablee state"
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

async function withNewBrowserWindow(fn) {
  let win = await BrowserTestUtils.openNewBrowserWindow();
  try {
    await fn(win);
  } finally {
    await BrowserTestUtils.closeWindow(win);
  }
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

add_task(async function testConnectOptionNotShown() {
  await withNewBrowserWindow(async win => {
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
  await withNewBrowserWindow(async win => {
    const { gBrowser } = win;

    await CompanionHelper.whenReady(async helper => {
      let testUrl = "https://test2.example.com/";
      let domain = "test2.example.com";

      await assertConnectCard(helper, { length: 0 });

      let urlHandled = waitForDomainHandled(helper, domain);

      await loadURI(gBrowser, testUrl);
      await urlHandled;

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

      await connected;
      await assertConnectCard(helper, {
        service: "testservice",
        length: 1,
        connected: true,
        recentlyAuthed: true,
        hideService: true,
      });

      await PinebuildTestUtils.logoutFromTestService("testservice");
    }, win);
  });
});

add_task(async function testDuplicateServiceTypeHidden() {
  await withNewBrowserWindow(async win => {
    const { gBrowser } = win;

    await CompanionHelper.whenReady(async helper => {
      await assertConnectCard(helper, { length: 0 });
      await PinebuildTestUtils.loginToTestService("testservice-connect");
      await assertConnectCard(helper, {
        service: "testservice",
        length: 1,
        connected: true,
        recentlyAuthed: true,
        hideService: true,
      });
      await assertConnectCard(helper, { length: 0 });

      let testUrl = "https://test2.example.com/";
      let domain = "test2.example.com";

      let urlHandled = waitForDomainHandled(helper, domain);

      await loadURI(gBrowser, testUrl);
      await urlHandled;
      await assertConnectCard(helper, { service: "testservice", length: 0 });
      await PinebuildTestUtils.logoutFromTestService("testservice-connect");
    }, win);
  });
});

add_task(async function testOauthFlow() {
  await withNewBrowserWindow(async win => {
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
        service: "testserviceauth",
        length: 1,
        connected: false,
        authenticating: false,
        clickConnect: true,
      });

      await authStarted;

      await assertConnectCard(helper, {
        service: "testserviceauth",
        length: 1,
        connected: false,
        authenticating: true,
        hideService: true,
      });
    }, win);
  });
});
