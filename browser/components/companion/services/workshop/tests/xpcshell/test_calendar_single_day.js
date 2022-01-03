/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/* globals DEFAULT_FAKE_NOW_TS, WorkshopHelper, GapiConfigurator, MapiConfigurator */

"use strict";

/**
 * Validate calendar synchronization for the current day.
 */
async function check_single_day_for_account_type({
  configurator,
  initialEventSketches,
  addEventSketches,
  changeEventSketches,
  errors,
}) {
  const initialEvents = WorkshopHelper.deriveFullEvents({
    eventSketches: initialEventSketches,
  });
  // (These will get scheduled sequentially after the ones above.)
  const addEvents = WorkshopHelper.deriveFullEvents({
    eventSketches: addEventSketches,
  });

  const changeEvents = WorkshopHelper.deriveFullEvents({
    eventSketches: changeEventSketches,
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
  // viewFolderMessages will trigger a "sync_refresh" task automatically for us.
  // Note that the seek should also result in an update to the list, but it will
  // not be marked as a `coherentSnapshot` so we will not receive a "seeked"
  // event until the sync_refresh completes.
  calView.seekToTop(10, 990);
  WorkshopHelper.eventsEqual(calView.items, []);

  // ### Then we sync/refresh and we should have today's events.

  // The automatically scheduled "sync_refresh" from above should result in a
  // single "seeked" update at which time we should have all of our data.  The
  // BatchManager should have delayed flushing until the sync_refresh task group
  // completed.
  await calView.promisedOnce("seeked");

  WorkshopHelper.eventsEqual(calView.items, initialEvents);

  // ### Release the review and reload its contents from disk
  calView.release();
  calView = workshopAPI.viewFolderMessages(calFolder);
  calView.seekToTop(10, 990);
  await calView.promisedOnce("seeked");
  WorkshopHelper.eventsEqual(calView.items, initialEvents);

  // ### Have the server add another event and then we sync it.
  fakeServer.defaultCalendar.addEvents(addEvents);
  await calView.refresh();

  let currentEvents = [...initialEvents, ...addEvents];

  WorkshopHelper.eventsEqual(calView.items, currentEvents);

  fakeServer.defaultCalendar.changeEvents(changeEvents);
  fakeServer.invalidateCalendarTokens();
  await calView.refresh();

  // Apply the changes to currentEvents.
  for (const event of changeEventSketches) {
    const e = currentEvents.find(x => x.summary === event.summary);
    for (const [key, value] of Object.entries(event)) {
      e[key] = value;
    }
  }
  // and then verify that changes are correct.
  WorkshopHelper.eventsEqual(calView.items, currentEvents);

  const eventAfterErrors = WorkshopHelper.deriveFullEvents({
    eventSketches: [errors.pop()],
  });

  fakeServer.addErrors(errors);
  fakeServer.defaultCalendar.addEvents(eventAfterErrors);

  await calView.refresh();

  currentEvents = [...currentEvents, ...eventAfterErrors];
  WorkshopHelper.eventsEqual(calView.items, currentEvents);
}

const oneHour = 60 * 60 * 1000;

const INITIAL_EVENTS = [
  {
    summary: "Morning Meeting",
  },
  {
    summary: "Coffee Meeting",
  },
  {
    summary: "Lunch",
  },
  {
    summary: "Afternoon Meeting",
  },
  {
    summary: "Moving Meeting",
    startDate: new Date(DEFAULT_FAKE_NOW_TS + 8 * oneHour),
    endDate: new Date(DEFAULT_FAKE_NOW_TS + 9 * oneHour),
  },
];

const ADD_EVENTS = [
  {
    summary: "Late breaking meeting!",
  },
];

const CHANGE_EVENTS = [
  {
    summary: "Moving Meeting",
    startDate: new Date(DEFAULT_FAKE_NOW_TS + 10 * oneHour),
    endDate: new Date(DEFAULT_FAKE_NOW_TS + 11 * oneHour),
  },
];

const ERRORS = [
  {
    code: 429,
    message: "Rate Limit Exceeded",
  },
  {
    code: 429,
    message: "Rate Limit Exceeded",
  },
  {
    // The event to add after adding the errors.
    summary: "An event after some errors",
  },
];

add_task(async function test_gapi_calendar_single_day() {
  await check_single_day_for_account_type({
    configurator: GapiConfigurator,
    initialEventSketches: INITIAL_EVENTS,
    addEventSketches: ADD_EVENTS,
    changeEventSketches: CHANGE_EVENTS,
    errors: ERRORS.slice(),
  });
});

add_task(async function test_mapi_calendar_single_day() {
  await check_single_day_for_account_type({
    configurator: MapiConfigurator,
    initialEventSketches: INITIAL_EVENTS,
    addEventSketches: ADD_EVENTS,
    changeEventSketches: CHANGE_EVENTS,
    errors: ERRORS.slice(),
  });
});
