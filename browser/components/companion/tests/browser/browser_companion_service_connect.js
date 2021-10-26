/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

registerCleanupFunction(() => {
  // No matter what happens, blow away window history after this file runs
  // to avoid leaking state between tests.
  gGlobalHistory.reset();
});

add_task(async function setup() {
  await SpecialPowers.pushPrefEnv({
    set: [
      [
        "browser.pinebuild.companion.test-services",
        JSON.stringify([
          {
            icon: "chrome://browser/content/companion/googleAccount.png",
            name: "Test service",
            services: "Test calendar things",
            domains: ["www.example.com", "test2.example.com"],
            type: "test-service",
          },
        ]),
      ],
    ],
  });
});

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

      await helper.runCompanionTask(async () => {
        let servicesOnboarding = content.document.querySelector(
          "services-onboarding"
        );
        ok(!servicesOnboarding.currentService, "No connect to service shown");
        ok(
          !servicesOnboarding.connectServiceElements.length,
          "No connect-service elements shown"
        );
      });
    }, win);
  });
});

add_task(async function testConnectOptionShown() {
  await withNewBrowserWindow(async win => {
    const { gBrowser } = win;

    await CompanionHelper.whenReady(async helper => {
      let testUrl = "https://test2.example.com/";
      let domain = "test2.example.com";

      let urlHandled = waitForDomainHandled(helper, domain);

      await loadURI(gBrowser, testUrl);
      await urlHandled;

      let connectServiceCalled = TestUtils.topicObserved(
        "pinebuild-test-connect-service",
        (_, data) => data == "test-service"
      );

      await helper.runCompanionTask(async () => {
        let servicesOnboarding = content.document.querySelector(
          "services-onboarding"
        );
        is(
          servicesOnboarding.currentService,
          "test-service",
          "test-service should be shown"
        );
        is(
          servicesOnboarding.connectServiceElements.length,
          1,
          "The test service is shown"
        );

        let connectService = servicesOnboarding.connectServiceElements[0];
        is(
          connectService.type,
          "test-service",
          "The connect card is for the test service"
        );
        connectService.connectButton.click();
      });

      await connectServiceCalled;
    }, win);
  });
});
