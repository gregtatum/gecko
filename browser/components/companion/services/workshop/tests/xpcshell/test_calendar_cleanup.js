/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/* globals DEFAULT_FAKE_NOW_TS, WorkshopHelper, GapiConfigurator, MapiConfigurator */

"use strict";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const today = new Date(DEFAULT_FAKE_NOW_TS + 9 * HOUR);

/**
 * Validate account auto-cleanup.
 */
async function check_account_cleanup({ configurator, initialEventSketches }) {
  const initialEvents = WorkshopHelper.deriveFullEvents({
    eventSketches: initialEventSketches,
  });

  const fakeServer = await WorkshopHelper.createFakeServer({
    configurator,
    events: initialEvents,
  });

  const workshopAPI = await WorkshopHelper.startBackend({});

  // ## Setup
  const result = await workshopAPI.tryToCreateAccount(
    {},
    fakeServer.domainInfo
  );

  const spec = {
    kind: "calendar",
    filter: {
      // All folders (and therefore calendars).
      tag: "",
      // Get all events by not specifying a truthy `durationBeforeInMinutes`.
      event: {},
    },
  };

  const { error, account } = result;
  equal(error, null, "error is null");
  ok(account, "account is non-null");

  await account.syncFolderList();

  const calFolder = account.folders.getFirstFolderWithType("calendar");
  ok(calFolder, "have calendar folder");

  // ### View the contents of the folder in its entirety
  let calView = workshopAPI.viewFolderMessages(calFolder);

  // ## Sync Tests Proper

  // ### Initially, there should be no events.
  calView.seekToTop(10, 990);
  WorkshopHelper.eventsEqual(calView.items, []);

  // ### Then we sync/refresh and we should have events.
  await calView.promisedOnce("seeked");

  // We just check that everything is fine even for the sanity.
  WorkshopHelper.eventsEqual(calView.items, initialEvents);

  // Move in the future !!
  const SYNC_OLD = 1;
  workshopAPI.TEST_timeWarp({
    fakeNow: new Date(today.valueOf() + (SYNC_OLD + 0.5) * DAY),
  });

  await workshopAPI.cleanupAllAccounts(spec);
  await calView.promisedOnce("seeked");

  // Currently, we sync 1 days into the past, so by moving 1.5 days into the
  // future, only the first event will be cleaned. So remove it from the list of
  // initialEvents because we no longer expect it to be present.
  initialEvents.splice(0, 1);
  WorkshopHelper.eventsEqual(calView.items, initialEvents);

  await WorkshopHelper.cleanBackend(workshopAPI);
}

const INITIAL_EVENTS = [
  {
    summary: "Morning Meeting",
    start: today.toISOString(),
    end: new Date(today.valueOf() + HOUR).toISOString(),
  },
  {
    summary: "Coffee Meeting",
    start: new Date(today.valueOf() + DAY).toISOString(),
    end: new Date(today.valueOf() + DAY + HOUR).toISOString(),
  },
  {
    summary: "Lunch",
    start: new Date(today.valueOf() + 2 * DAY).toISOString(),
    end: new Date(today.valueOf() + 2 * DAY + HOUR).toISOString(),
  },
  {
    summary: "Afternoon Meeting",
    start: new Date(today.valueOf() + 3 * DAY).toISOString(),
    end: new Date(today.valueOf() + 3 * DAY + HOUR).toISOString(),
  },
];

add_task(async function test_gapi_calendar_account_cleanup() {
  await check_account_cleanup({
    configurator: GapiConfigurator,
    initialEventSketches: INITIAL_EVENTS,
  });
});

add_task(async function test_mapi_calendar_account_cleanup() {
  await check_account_cleanup({
    configurator: MapiConfigurator,
    initialEventSketches: INITIAL_EVENTS,
  });
});
