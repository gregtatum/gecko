/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/* globals WorkshopHelper, FeedConfigurator */

"use strict";

/**
 * Validate a feed account with a feed generated from a calendar.
 */
async function check_feed_account({
  configurator,
  initialEventSketches,
  addEventSketches,
  calendarId,
  feedType,
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
    configurator,
    events: initialEvents,
  });

  const workshopAPI = await WorkshopHelper.startBackend({});

  // ## Setup
  const result = await workshopAPI.tryToCreateAccount(
    {
      feedUrl: `http://${configurator.hosts[0]}/feed/${calendarId}/${feedType}`,
    },
    fakeServer.domainInfo
  );

  const { error, account } = result;
  equal(error, null, "error is null");
  ok(account, "account is non-null");

  await account.syncFolderList();

  const feedFolder = account.folders.getFirstFolderWithType("inbox");
  ok(feedFolder, "have feed folder");

  // ### View the contents of the folder in its entirety
  const feedView = workshopAPI.viewFolderMessages(feedFolder);

  // ## Sync Tests Proper

  // ### Initially, there should be no events.
  // viewFolderMessages will trigger a "sync_refresh" task automatically for us.
  // Note that the seek should also result in an update to the list, but it will
  // not be marked as a `coherentSnapshot` so we will not receive a "seeked"
  // event until the sync_refresh completes.
  feedView.seekToTop(10, 990);
  WorkshopHelper.eventsEqual(feedView.items, []);

  // ### Then we sync/refresh and we should have today's events.

  // The automatically scheduled "sync_refresh" from above should result in a
  // single "seeked" update at which time we should have all of our data.  The
  // BatchManager should have delayed flushing until the sync_refresh task group
  // completed.
  await feedView.promisedOnce("seeked");

  for (const item of feedView.items) {
    item.summary = item.subject;
  }
  WorkshopHelper.eventsEqual(feedView.items, initialEvents);

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

/* We don't really care about the data we can have in the feed itself.
   So we just reuse the ones we have for events.
   */
add_task(async function test_rss_account() {
  await check_feed_account({
    configurator: FeedConfigurator,
    initialEventSketches: INITIAL_EVENTS,
    addEventSketches: ADD_EVENTS,
    calendarId: "default",
    feedType: "rss",
  });
});

add_task(async function test_atom_account() {
  await check_feed_account({
    configurator: FeedConfigurator,
    initialEventSketches: INITIAL_EVENTS,
    addEventSketches: ADD_EVENTS,
    calendarId: "default",
    feedType: "atom",
  });
});
