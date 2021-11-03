/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/* globals WorkshopHelper, GapiConfigurator, MapiConfigurator */

"use strict";

/**
 * Helper that divides up the contents of an array by traversing the contents of
 * an array using a fixed step-size.  Has a cool name to make up for the boring
 * implementation.
 *
 * @param {Array} inArray
 *   The array whose contents should be divided up.
 * @param {Number} shardIndex
 *   The index of the shard in the range [0, totalShards).
 * @param {Number} totalShards
 *   How many shards are you going to ask for?
 */
function computeArrayShard(inArray, shardIndex, totalShards) {
  const resultArr = [];
  for (let i = shardIndex; i < inArray.length; i += totalShards) {
    resultArr.push(inArray[i]);
  }
  return resultArr;
}

/**
 * Helper to create (potentially) multiple accounts with (potentially) multiple
 * calendars per account and then verify that `searchAllMessages`.  This
 * function then gets called by specific test cases which define the
 * configuration.
 *
 * TODO: Actually support being called multiple times and with multiple accounts
 * per fake-server type.  This will require enhancements to the fake-servers.
 */
async function check_searchAllMessages_with_accounts({
  accountConfigs,
  initialEventSketches,
  addEventSketches,
}) {
  // XXX Currently this marks the events as having the WorkshopHelperClass.user
  // as both the `creator` and `organizer` but this is conceptually a little
  // weird given that the events will be spread across multiple accounts, so
  // this and the uses of `computeArrayShard` on its results probably wants to
  // be rethought.  For now this is best because it ensures that the accounts
  // all have their events sequentially interleaved without any new code.
  const initialEvents = WorkshopHelper.deriveFullEvents({
    eventSketches: initialEventSketches,
  });

  let totalCalendarCount = 0;
  for (const { calendarCount } of accountConfigs) {
    // TODO: I'm planning ahead to support this but this won't happen in the
    // first round.
    if (calendarCount !== 1) {
      throw new Error("TODO: Actually support multiple calendars per account.");
    }
    totalCalendarCount += calendarCount;
  }
  let calendarShardIndex = 0;

  // ## Start up the Fake Servers
  const allFakeServers = [];
  for (const { configurator } of accountConfigs) {
    // XXX the calendarCount should matter here, see TODOs above.
    const thisShardIndex = calendarShardIndex++;
    const fakeServer = await WorkshopHelper.createFakeServer({
      configurator,
      events: computeArrayShard(
        initialEvents,
        thisShardIndex,
        totalCalendarCount
      ),
    });

    allFakeServers.push(fakeServer);
  }

  // ## Start Workshop and Create the Accounts
  const workshopAPI = await WorkshopHelper.startBackend({});

  for (const fakeServer of allFakeServers) {
    const { account } = await workshopAPI.tryToCreateAccount(
      {},
      fakeServer.domainInfo
    );
    await account.syncFolderList();
  }

  // ## Sync Tests Proper
  // ### Create the searchAllMessagesView
  const calView = workshopAPI.searchAllMessages({
    kind: "calendar",
    filter: {
      // All folders (and therefore calendars).
      tag: "",
      // Get all events by not specifying a truthy `durationBeforeInMinutes`.
      event: {},
    },
  });

  // ### Initially, there should be no events.
  calView.seekToTop(10, 990);
  WorkshopHelper.eventsEqual(calView.items, []);
  // TODO: With nothing in the database currently I think we won't see a
  // coherentSnapshot "seeked" event...

  // ### Then we sync/refresh and we should have today's events.

  // Trigger a refresh across all the folders represented in the view.
  // TODO: Ensure that the resulting refresh gets grouped under a single task
  // group so that the coherentSnapshot mechanism will only fire once for the
  // group rather than after each individual folder updates.

  // XXX ARGH: The refreshes work correctly right now but the mailbridge is not
  // ending up sending back the "promisedResult" so there clearly is a bug, but
  // we can at least iterate on this if we just wait for each of the syncs to
  // complete and generate a coherent snapshot.  Note that per the above there's
  // 1 per account right now, but that should be reduced to 1 when we force the
  // syncs all into the same task group.

  // XXX we should be awaiting this right now per the above, but the promise
  // doesn't resolve...
  calView.refresh();
  for (let i = 0; i < allFakeServers.length; i++) {
    await calView.promisedOnce("seeked");
  }

  WorkshopHelper.eventsEqual(calView.items, initialEvents);

  // ### Have the server add another event and then we sync it.
  // THIS CHECK CAN ONLY BE ENABLED ONCE THE CONVID ISSUE IS ADDRESSED
  // I AM LANDING IT LIKE THIS SO THE FIX CAN BE A SEPARATE COMMIT.
  /*
  fakeServer.defaultCalendar.addEvents(addEvents);
  await calView.refresh();

  WorkshopHelper.eventsEqual(calView.items, [...initialEvents, ...addEvents]);
  */

  // ## Cleanup
  // ### Delete the accounts.
  await Promise.all(
    workshopAPI.accounts.items.map(acct => acct.deleteAccount())
  );

  // TODO: This is where we'd decomission the fake-servers and/or their users.
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

add_task(async function test_all_types_single_calendar() {
  await check_searchAllMessages_with_accounts({
    accountConfigs: [
      {
        configurator: GapiConfigurator,
        calendarCount: 1,
      },
      {
        configurator: MapiConfigurator,
        calendarCount: 1,
      },
    ],
    initialEventSketches: INITIAL_EVENTS,
    addEventSketches: ADD_EVENTS,
  });
});
