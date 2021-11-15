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
  // (These will get scheduled sequentially after the ones above.)
  const addEvents = WorkshopHelper.deriveFullEvents({
    eventSketches: addEventSketches,
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
  const spec = {
    kind: "calendar",
    filter: {
      // All folders (and therefore calendars).
      tag: "",
      // Get all events by not specifying a truthy `durationBeforeInMinutes`.
      event: {},
    },
  };

  const calView = workshopAPI.searchAllMessages(spec);

  // ### Initially, there should be no events.
  calView.seekToTop(10, 990);
  WorkshopHelper.eventsEqual(calView.items, []);
  // TODO: With nothing in the database currently I think we won't see a
  // coherentSnapshot "seeked" event...

  // ### Then we sync/refresh and we should have today's events.

  // Trigger a refresh across all the folders represented in the view.
  // Note: This still happens as N separate task groups, but this refresh
  // request is a Promise.all() over all of those, so this does what we want,
  // but because there isn't a single task group, we will be seeing multiple
  // coherent snapshots.
  await workshopAPI.refreshAllMessages(spec);

  WorkshopHelper.eventsEqual(calView.items, initialEvents);

  // ### Spread out our additional events over the fake-servers / calendars
  calendarShardIndex = 0;
  for (const fakeServer of allFakeServers) {
    // XXX the calendarCount should matter here, see TODOs around the initial
    // event population too.
    const thisShardIndex = calendarShardIndex++;
    fakeServer.defaultCalendar.addEvents(
      computeArrayShard(addEvents, thisShardIndex, totalCalendarCount)
    );
  }
  await workshopAPI.refreshAllMessages(spec);

  WorkshopHelper.eventsEqual(calView.items, [...initialEvents, ...addEvents]);

  // ## Cleanup
  // ### Delete the accounts.
  const expectedNulls = new Array(allFakeServers.length);
  expectedNulls.fill(null);
  const nullDeletions = await Promise.all(
    workshopAPI.accounts.items.map(acct => acct.deleteAccount())
  );
  deepEqual(
    nullDeletions,
    expectedNulls,
    "deleteAccount should resolve with null"
  );

  deepEqual(workshopAPI.accounts.items, [], "no more accounts after deletion!");

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
  {
    summary: "Oh wow, another late breaking meeting!",
  },
  {
    summary: "Yeah, I know, another one of these late breaking meetings!",
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
