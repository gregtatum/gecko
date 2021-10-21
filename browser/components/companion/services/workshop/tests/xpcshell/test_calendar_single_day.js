/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/*globals WorkshopHelper */

"use strict";

/**
 * Validate calendar synchronization for the current day.
 */
async function check_single_day_for_account_type({
  accountType,
  initialEventSketches,
  addEventSketches,
}) {
  const initialEvents = WorkshopHelper.deriveFullEvents({
    eventSketches: initialEventSketches,
  });
  // (These will get scheduled sequentially after the ones above.)
  /*
  const addEvents = WorkshopHelper.deriveFullEvents({
    eventSketches: addEventSketches,
  });
  */

  const fakeServer = await WorkshopHelper.createFakeServer({
    type: accountType,
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
  const calView = workshopAPI.viewFolderMessages(calFolder);

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

  // ### Have the server add another event and then we sync it.
  // THIS CHECK CAN ONLY BE ENABLED ONCE THE CONVID ISSUE IS ADDRESSED
  // I AM LANDING IT LIKE THIS SO THE FIX CAN BE A SEPARATE COMMIT.
  /*
  fakeServer.defaultCalendar.addEvents(addEvents);
  await calView.refresh();

  WorkshopHelper.eventsEqual(calView.items, [...initialEvents, ...addEvents]);
  */
}

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
];

const ADD_EVENTS = [
  {
    summary: "Late breaking meeting!",
  },
];

add_task(async function test_gapi_calendar_single_day() {
  await check_single_day_for_account_type({
    accountType: "gapi",
    initialEventSketches: INITIAL_EVENTS,
    addEventSketches: ADD_EVENTS,
  });
});

/*
add_task(async function test_mapi_calendar_single_day() {
  await check_single_day_for_account_type({
    accountType: "mapi",
    initialEventSketches: INITIAL_EVENTS,
    addEventSketches: ADD_EVENTS,
  });
});
*/
