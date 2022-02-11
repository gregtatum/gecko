/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/* globals DEFAULT_FAKE_NOW_TS, WorkshopHelper, GapiConfigurator, MapiConfigurator */

"use strict";

async function getAndCompare(workshopAPI, calFolder, expectedCounts, round) {
  const convView = workshopAPI.viewFolderConversations(calFolder);
  convView.seekToTop(10, 990);
  WorkshopHelper.eventsEqual(convView.items, []);
  await convView.promisedOnce("seeked");

  const counts = convView.items
    .map(item => [item.firstSubject, item.messageCount])
    .sort();

  deepEqual(
    counts,
    expectedCounts,
    `conversations have the same number of events (round ${round})`
  );

  convView.release();
}

/**
 * Validate calendar synchronization with some recurring events.
 */
async function check_recurring_events_for_account_type({
  configurator,
  initialEventSketches,
  addEventSketches,
  cancelledEventSketches,
  changingEventSketches,
}) {
  const initialEvents = WorkshopHelper.deriveFullEvents({
    eventSketches: initialEventSketches,
  });

  const addEvents = WorkshopHelper.deriveFullEvents({
    eventSketches: addEventSketches,
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

  const mapEventFn = item => [item.summary, item.expectedNumber || 1];
  const expectedCounts = initialEventSketches.map(mapEventFn).sort();

  const rounds = 2;
  for (let i = 0; i <= rounds; i++) {
    // When i === counts all the events are sent without taking into account the
    // sync token.
    // For example, the server could have some failures and resend the same
    // events two times even if there are no modifications between.
    // And in such a case, workshop mustn't create some new events.
    if (i === rounds) {
      fakeServer.invalidateCalendarTokens();
    }

    await getAndCompare(workshopAPI, calFolder, expectedCounts, i);
  }

  // Add a recurring event.
  fakeServer.defaultCalendar.addEvents(addEvents);
  expectedCounts.push(...addEventSketches.map(mapEventFn));
  expectedCounts.sort();
  await getAndCompare(workshopAPI, calFolder, expectedCounts, rounds + 1);

  // Remove some events.
  for (const {
    summary,
    startDates,
    removeRecurrentId,
  } of cancelledEventSketches) {
    fakeServer.defaultCalendar.cancelEvent(
      summary,
      startDates,
      !!removeRecurrentId
    );
    const i = expectedCounts.findIndex(x => x[0] === summary);
    if (!startDates || startDates.length === 0) {
      expectedCounts.splice(i, 1);
    } else {
      expectedCounts[i][1] -= startDates.length;
    }
  }

  await getAndCompare(workshopAPI, calFolder, expectedCounts, rounds + 2);

  if (changingEventSketches) {
    // Remove the second event of some recurring events.
    for (const { summary, newSummary } of changingEventSketches) {
      fakeServer.defaultCalendar.changeSecondInstAndFollowing(
        summary,
        newSummary
      );
      const i = expectedCounts.findIndex(x => x[0] === summary);
      const total = expectedCounts[i][1];
      expectedCounts[i][1] = 1;
      expectedCounts.splice(i + 1, 0, [newSummary, total - 1]);
    }

    await getAndCompare(workshopAPI, calFolder, expectedCounts, rounds + 3);
  }
}

const today = new Date(DEFAULT_FAKE_NOW_TS).toISOString().split("T")[0];
const DAY = 24 * 60 * 60 * 1000;
const inTwoDays = new Date(new Date(DEFAULT_FAKE_NOW_TS).valueOf() + 2 * DAY)
  .toISOString()
  .split("T")[0];

// See workshop/src/backend/accounts/gapi/cal_folder_sync_state_helper.js,
// we get events which are in the range [today - 15 days; today + 60 days].
const INITIAL_EVENTS = [
  {
    summary: "Weekly Meeting",
    start: `${today}T09:00:00.000Z`,
    end: `${today}T09:30:00.000Z`,

    every: "week",
    // We've an event for today and one every week until today + 56
    // (today, today + 7, .... today + 56) so we've 9 events.
    expectedNumber: 9,
  },
  {
    summary: "Fortnightly Coffee Meeting",
    start: `${today}T10:00:00.000Z`,
    end: `${today}T10:20:00.000Z`,

    every: "2-weeks",
    // We've an event for today and one every week until today + 56
    // (today, today + 14, .... today + 56) so we've 5 events.
    expectedNumber: 5,
  },
  {
    summary: "Meeting with Karl and Leonhard",
    start: `${inTwoDays}T03:14:15.000Z`,
    end: `${inTwoDays}T09:26:53.000Z`,
  },
  {
    summary: "Weekly Cold Meeting with an Hawaiian shirt",
    start: `${today}T09:00:00.000Z`,
    end: `${today}T09:30:00.000Z`,

    every: "week",
    // Same as above for "Weekly Meeting"
    expectedNumber: 9,
  },
];

const ADD_EVENTS = [
  {
    summary: "Late breaking meeting!",
    start: `${today}T12:00:00.000Z`,
    end: `${today}T13:30:00.000Z`,

    every: "week",
    // We've an event for today and one every week until today + 56
    // (today, today + 7, .... today + 56) so we've 9 events.
    expectedNumber: 9,
  },
];

const weeklyMeetingStart = new Date(INITIAL_EVENTS[0].start).valueOf();
const coffeeMeetingStart = new Date(INITIAL_EVENTS[1].start).valueOf();
const weekInMs = 7 * 24 * 60 * 60 * 1000;
const CANCELLED_EVENTS = [
  {
    summary: "Weekly Meeting",
    startDates: [
      new Date(weeklyMeetingStart + 2 * weekInMs),
      new Date(weeklyMeetingStart + 6 * weekInMs),
    ],
  },
  {
    summary: "Fortnightly Coffee Meeting",
    startDates: [new Date(coffeeMeetingStart)],
  },
  {
    summary: "Meeting with Karl and Leonhard",
  },
  {
    summary: "Weekly Meeting",
    startDates: [new Date(weeklyMeetingStart + 3 * weekInMs)],
    removeRecurrentId: true,
  },
];

const CHANGING_EVENTS = [
  {
    summary: "Weekly Cold Meeting with an Hawaiian shirt",
    newSummary: "Weekly Hot meeting with an Hawaiian shirt",
  },
];

add_task(async function test_gapi_calendar_single_day() {
  await check_recurring_events_for_account_type({
    configurator: GapiConfigurator,
    initialEventSketches: INITIAL_EVENTS,
    addEventSketches: ADD_EVENTS,
    cancelledEventSketches: CANCELLED_EVENTS,
    changingEventSketches: CHANGING_EVENTS,
  });
});

add_task(async function test_mapi_calendar_single_day() {
  await check_recurring_events_for_account_type({
    configurator: MapiConfigurator,
    initialEventSketches: INITIAL_EVENTS,
    addEventSketches: ADD_EVENTS,
    cancelledEventSketches: CANCELLED_EVENTS,
  });
});
