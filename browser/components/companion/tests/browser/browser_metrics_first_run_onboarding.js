/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/
 */

"use strict";

/*
 * This file verifies that the correct Glean and Telemetry events are recorded
 * for each of the steps in the first run onboarding flow.
 *
 * List of events:
 * Glean.pinebuild.onboardingShownWelcome
 * Glean.pinebuild.onboardingDoneWelcome
 *
 * Glean.pinebuild.onboardingShownConnectFxa
 * Glean.pinebuild.onboardingDoneConnectFxa
 *
 * Glean.pinebuild.onboardingShownFxaConnected
 * Glean.pinebuild.onboardingDoneFxaConnected
 *
 * Glean.pinebuild.onboardingShownDataPrefs
 * Glean.pinebuild.onboardingDoneDataPrefs
 *
 * Glean.pinebuild.onboardingShownCongrats
 * Glean.pinebuild.onboardingDoneCongrats
 */

const { TelemetryTestUtils } = ChromeUtils.import(
  "resource://testing-common/TelemetryTestUtils.jsm"
);

const ONBOARDING_PREF = "browser.pinebuild.onboarding.complete";

add_setup(async () => {
  Services.telemetry.setEventRecordingEnabled("pinebuild.onboarding", true);
  registerCleanupFunction(async () => {
    Services.telemetry.setEventRecordingEnabled("pinebuild.onboarding", false);
  });
});

// `progressPref` is an integer indicating which step in onboarding to load.
const setup = async ({ progressPref }) => {
  await SpecialPowers.pushPrefEnv({
    set: [["browser.pinebuild.onboarding.progress", progressPref]],
  });
  Services.telemetry.clearEvents();
  Services.fog.testResetFOG();
};

const openClickAndCloseOnboarding = async selector => {
  let win = await BrowserTestUtils.openNewBrowserWindow();
  let browser = win.gBrowser.selectedBrowser;
  BrowserTestUtils.loadURI(browser, "about:onboarding");
  await BrowserTestUtils.browserLoaded(browser, false, "about:onboarding");

  if (selector) {
    await BrowserTestUtils.synthesizeMouseAtCenter(selector, {}, browser);
  }

  // Eagerly close the test window, to flush queued probes.
  return BrowserTestUtils.closeWindow(win);
};

const openAndCloseOnboarding = async () => {
  // To avoid helper duplication, just call the other function without any
  // selector.
  return openClickAndCloseOnboarding();
};

const assertEvent = (expected, actual) => {
  // Assert on the fields we care about, ignoring `actual.timestamp`.
  Assert.equal(expected.category, actual.category);
  Assert.equal(expected.name, actual.name);
  Assert.deepEqual(expected.extra, actual.extra);
};

add_task(async function test_record_welcome_shown() {
  await setup({ progressPref: 0 });

  const before = Glean.pinebuild.onboardingShownWelcome.testGetValue();
  Assert.equal(undefined, before);
  TelemetryTestUtils.assertNumberOfEvents(0);

  await openAndCloseOnboarding();

  const after = Glean.pinebuild.onboardingShownWelcome.testGetValue();
  Assert.equal(1, after.length);
  const expected = {
    category: "pinebuild",
    name: "onboarding_shown_welcome",
    extra: {
      order: "0",
      is_last: "false",
    },
  };
  assertEvent(expected, after[0]);
  TelemetryTestUtils.assertEvents(
    [
      {
        object: "welcome",
        value: null,
        extra: { order: "0", is_last: "false" },
      },
    ],
    {
      category: "pinebuild.onboarding",
      method: "shown",
    }
  );
});

add_task(async function test_record_welcome_done_primary_button() {
  await setup({ progressPref: 0 });

  const before = Glean.pinebuild.onboardingDoneWelcome.testGetValue();
  Assert.equal(undefined, before);
  TelemetryTestUtils.assertNumberOfEvents(0);

  await openClickAndCloseOnboarding(
    "section.onboarding-flow-card:not([hidden]) button"
  );

  const after = Glean.pinebuild.onboardingDoneWelcome.testGetValue();
  Assert.equal(1, after.length);
  const expected = {
    category: "pinebuild",
    name: "onboarding_done_welcome",
    extra: {
      order: "0",
      is_last: "false",
    },
  };
  assertEvent(expected, after[0]);
  TelemetryTestUtils.assertEvents(
    [
      {
        object: "welcome",
        value: null,
        extra: { order: "0", is_last: "false" },
      },
    ],
    {
      category: "pinebuild.onboarding",
      method: "done",
    }
  );
});

// There is a small forward arrow button to the right of the onboarding cards.
// Verify that the Event is recorded if the user clicks that button, instead
// of the primary button in the card.
add_task(async function test_record_welcome_done_forward_button() {
  await setup({ progressPref: 0 });

  const before = Glean.pinebuild.onboardingDoneWelcome.testGetValue();
  Assert.equal(undefined, before);
  TelemetryTestUtils.assertNumberOfEvents(0);

  await openClickAndCloseOnboarding("button.onboarding-forward-nav");

  const after = Glean.pinebuild.onboardingDoneWelcome.testGetValue();
  Assert.equal(1, after.length);
  const expected = {
    category: "pinebuild",
    name: "onboarding_done_welcome",
    extra: {
      order: "0",
      is_last: "false",
    },
  };
  assertEvent(expected, after[0]);
  TelemetryTestUtils.assertEvents(
    [
      {
        object: "welcome",
        value: null,
        extra: { order: "0", is_last: "false" },
      },
    ],
    {
      category: "pinebuild.onboarding",
      method: "done",
    }
  );
});

add_task(async function test_record_connect_fxa_shown() {
  await setup({ progressPref: 1 });

  const before = Glean.pinebuild.onboardingShownConnectFxa.testGetValue();
  Assert.equal(undefined, before);
  TelemetryTestUtils.assertNumberOfEvents(0);

  await openAndCloseOnboarding();

  const after = Glean.pinebuild.onboardingShownConnectFxa.testGetValue();
  Assert.equal(1, after.length);
  const expected = {
    category: "pinebuild",
    name: "onboarding_shown_connect_fxa",
    extra: {
      order: "1",
      is_last: "false",
    },
  };
  assertEvent(expected, after[0]);
  TelemetryTestUtils.assertEvents(
    [
      {
        object: "connect_fxa",
        value: null,
        extra: { order: "1", is_last: "false" },
      },
    ],
    {
      category: "pinebuild.onboarding",
      method: "shown",
    }
  );
});

add_task(async function test_record_connect_fxa_done() {
  await setup({ progressPref: 1 });

  const before = Glean.pinebuild.onboardingDoneConnectFxa.testGetValue();
  Assert.equal(undefined, before);
  TelemetryTestUtils.assertNumberOfEvents(0);

  await openClickAndCloseOnboarding(
    "section.onboarding-flow-card:not([hidden]) button"
  );

  const after = Glean.pinebuild.onboardingDoneConnectFxa.testGetValue();
  Assert.equal(1, after.length);
  const expected = {
    category: "pinebuild",
    name: "onboarding_done_connect_fxa",
    extra: {
      order: "1",
      is_last: "false",
    },
  };
  assertEvent(expected, after[0]);
  TelemetryTestUtils.assertEvents(
    [
      {
        object: "connect_fxa",
        value: null,
        extra: { order: "1", is_last: "false" },
      },
    ],
    {
      category: "pinebuild.onboarding",
      method: "done",
    }
  );
});

add_task(async function test_record_fxa_connected_shown() {
  await setup({ progressPref: 2 });

  const before = Glean.pinebuild.onboardingShownFxaConnected.testGetValue();
  Assert.equal(undefined, before);
  TelemetryTestUtils.assertNumberOfEvents(0);

  await openAndCloseOnboarding();

  const after = Glean.pinebuild.onboardingShownFxaConnected.testGetValue();
  Assert.equal(1, after.length);
  const expected = {
    category: "pinebuild",
    name: "onboarding_shown_fxa_connected",
    extra: {
      order: "2",
      is_last: "false",
    },
  };
  assertEvent(expected, after[0]);
  TelemetryTestUtils.assertEvents(
    [
      {
        object: "fxa_connected",
        value: null,
        extra: { order: "2", is_last: "false" },
      },
    ],
    {
      category: "pinebuild.onboarding",
      method: "shown",
    }
  );
});

add_task(async function test_record_fxa_connected_done_primary_button() {
  await setup({ progressPref: 2 });

  const before = Glean.pinebuild.onboardingDoneFxaConnected.testGetValue();
  Assert.equal(undefined, before);
  TelemetryTestUtils.assertNumberOfEvents(0);

  await openClickAndCloseOnboarding(
    "section.onboarding-flow-card:not([hidden]) button"
  );

  const after = Glean.pinebuild.onboardingDoneFxaConnected.testGetValue();
  Assert.equal(1, after.length);
  const expected = {
    category: "pinebuild",
    name: "onboarding_done_fxa_connected",
    extra: {
      order: "2",
      is_last: "false",
    },
  };
  assertEvent(expected, after[0]);
  TelemetryTestUtils.assertEvents(
    [
      {
        object: "fxa_connected",
        value: null,
        extra: { order: "2", is_last: "false" },
      },
    ],
    {
      category: "pinebuild.onboarding",
      method: "done",
    }
  );
});

add_task(async function test_record_fxa_connected_done_forward_button() {
  await setup({ progressPref: 2 });

  const before = Glean.pinebuild.onboardingDoneFxaConnected.testGetValue();
  Assert.equal(undefined, before);
  TelemetryTestUtils.assertNumberOfEvents(0);

  await openClickAndCloseOnboarding("button.onboarding-forward-nav");

  const after = Glean.pinebuild.onboardingDoneFxaConnected.testGetValue();
  Assert.equal(1, after.length);
  const expected = {
    category: "pinebuild",
    name: "onboarding_done_fxa_connected",
    extra: {
      order: "2",
      is_last: "false",
    },
  };
  assertEvent(expected, after[0]);
  TelemetryTestUtils.assertEvents(
    [
      {
        object: "fxa_connected",
        value: null,
        extra: { order: "2", is_last: "false" },
      },
    ],
    {
      category: "pinebuild.onboarding",
      method: "done",
    }
  );
});

add_task(async function test_record_data_prefs_shown() {
  await setup({ progressPref: 3 });

  const before = Glean.pinebuild.onboardingShownDataPrefs.testGetValue();
  Assert.equal(undefined, before);
  TelemetryTestUtils.assertNumberOfEvents(0);

  await openAndCloseOnboarding();

  const after = Glean.pinebuild.onboardingShownDataPrefs.testGetValue();
  Assert.equal(1, after.length);
  const expected = {
    category: "pinebuild",
    name: "onboarding_shown_data_prefs",
    extra: {
      order: "3",
      is_last: "false",
    },
  };
  assertEvent(expected, after[0]);
  TelemetryTestUtils.assertEvents(
    [
      {
        object: "data_prefs",
        value: null,
        extra: { order: "3", is_last: "false" },
      },
    ],
    {
      category: "pinebuild.onboarding",
      method: "shown",
    }
  );
});

add_task(async function test_record_data_prefs_done_primary_button() {
  await setup({ progressPref: 3 });

  const before = Glean.pinebuild.onboardingDoneDataPrefs.testGetValue();
  Assert.equal(undefined, before);
  TelemetryTestUtils.assertNumberOfEvents(0);

  await openClickAndCloseOnboarding(
    "section.onboarding-flow-card:not([hidden]) button"
  );

  const after = Glean.pinebuild.onboardingDoneDataPrefs.testGetValue();
  Assert.equal(1, after.length);
  const expected = {
    category: "pinebuild",
    name: "onboarding_done_data_prefs",
    extra: {
      order: "3",
      is_last: "false",
    },
  };
  assertEvent(expected, after[0]);
  TelemetryTestUtils.assertEvents(
    [
      {
        object: "data_prefs",
        value: null,
        extra: { order: "3", is_last: "false" },
      },
    ],
    {
      category: "pinebuild.onboarding",
      method: "done",
    }
  );
});

add_task(async function test_record_data_prefs_done_forward_button() {
  await setup({ progressPref: 3 });

  const before = Glean.pinebuild.onboardingDoneDataPrefs.testGetValue();
  Assert.equal(undefined, before);
  TelemetryTestUtils.assertNumberOfEvents(0);

  await openClickAndCloseOnboarding("button.onboarding-forward-nav");

  const after = Glean.pinebuild.onboardingDoneDataPrefs.testGetValue();
  Assert.equal(1, after.length);
  const expected = {
    category: "pinebuild",
    name: "onboarding_done_data_prefs",
    extra: {
      order: "3",
      is_last: "false",
    },
  };
  assertEvent(expected, after[0]);
  TelemetryTestUtils.assertEvents(
    [
      {
        object: "data_prefs",
        value: null,
        extra: { order: "3", is_last: "false" },
      },
    ],
    {
      category: "pinebuild.onboarding",
      method: "done",
    }
  );
});

add_task(async function test_record_congrats_shown() {
  await setup({ progressPref: 4 });

  const before = Glean.pinebuild.onboardingShownCongrats.testGetValue();
  Assert.equal(undefined, before);
  TelemetryTestUtils.assertNumberOfEvents(0);

  await openAndCloseOnboarding();

  const after = Glean.pinebuild.onboardingShownCongrats.testGetValue();
  Assert.equal(1, after.length);
  const expected = {
    category: "pinebuild",
    name: "onboarding_shown_congrats",
    extra: {
      order: "4",
      is_last: "true",
    },
  };
  assertEvent(expected, after[0]);
  TelemetryTestUtils.assertEvents(
    [
      {
        object: "congrats",
        value: null,
        extra: { order: "4", is_last: "true" },
      },
    ],
    {
      category: "pinebuild.onboarding",
      method: "shown",
    }
  );
});

add_task(async function test_record_congrats_done_primary_button() {
  await setup({ progressPref: 4 });

  const before = Glean.pinebuild.onboardingDoneCongrats.testGetValue();
  Assert.equal(undefined, before);
  TelemetryTestUtils.assertNumberOfEvents(0);

  await openClickAndCloseOnboarding(
    "section.onboarding-flow-card:not([hidden]) button"
  );

  const after = Glean.pinebuild.onboardingDoneCongrats.testGetValue();
  Assert.equal(1, after.length);
  const expected = {
    category: "pinebuild",
    name: "onboarding_done_congrats",
    extra: {
      order: "4",
      is_last: "true",
    },
  };
  assertEvent(expected, after[0]);
  TelemetryTestUtils.assertEvents(
    [
      {
        object: "congrats",
        value: null,
        extra: { order: "4", is_last: "true" },
      },
    ],
    {
      category: "pinebuild.onboarding",
      method: "done",
    }
  );
});

add_task(async function test_record_congrats_done_forward_button() {
  await setup({ progressPref: 4 });

  const before = Glean.pinebuild.onboardingDoneCongrats.testGetValue();
  Assert.equal(undefined, before);
  TelemetryTestUtils.assertNumberOfEvents(0);

  await openClickAndCloseOnboarding("button.onboarding-forward-nav");

  const after = Glean.pinebuild.onboardingDoneCongrats.testGetValue();
  Assert.equal(1, after.length);
  const expected = {
    category: "pinebuild",
    name: "onboarding_done_congrats",
    extra: {
      order: "4",
      is_last: "true",
    },
  };
  assertEvent(expected, after[0]);
  TelemetryTestUtils.assertEvents(
    [
      {
        object: "congrats",
        value: null,
        extra: { order: "4", is_last: "true" },
      },
    ],
    {
      category: "pinebuild.onboarding",
      method: "done",
    }
  );
});
