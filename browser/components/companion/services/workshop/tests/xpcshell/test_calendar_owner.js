/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/* globals WorkshopHelper, GapiConfigurator, MapiConfigurator */

"use strict";

async function check_calView_with_multiple_calendars({
  configurator,
  firstCalConfig,
  secondCalConfig,
}) {
  const initialEvents = WorkshopHelper.deriveFullEvents({
    eventSketches: firstCalConfig.eventSketches,
  });

  const secondCalEvents = WorkshopHelper.deriveFullEvents({
    eventSketches: secondCalConfig.eventSketches,
  });

  // ## Start up the Fake Servers
  const fakeServer = await WorkshopHelper.createFakeServer({
    configurator,
    events: initialEvents,
  });

  // Add a second calendar that the user doesn't own
  fakeServer.secondCalendar = fakeServer.populateCalendar({
    id: "second",
    name: "Another calendar",
    events: secondCalEvents,
    ...secondCalConfig,
  });

  // ## Start Workshop and Create the Accounts
  const workshopAPI = await WorkshopHelper.startBackend({});

  const { account } = await workshopAPI.tryToCreateAccount(
    {},
    fakeServer.domainInfo
  );
  await account.syncFolderList();

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

  // ### Then we sync/refresh and we should have only the events from the owned calendar.
  await workshopAPI.refreshAllMessages(spec);

  WorkshopHelper.eventsEqual(calView.items, initialEvents);

  await WorkshopHelper.cleanBackend(workshopAPI);
}

const FIRST_CAL_EVENTS = [
  {
    summary: "I own this meeting",
  },
  {
    summary: "I own this meeting too!",
  },
];

const SECOND_CAL_EVENTS = [
  {
    summary: "This meeting is on a shared calendar",
  },
];

add_task(async function test_gapi_calendar_owner() {
  await check_calView_with_multiple_calendars({
    configurator: GapiConfigurator,
    firstCalConfig: {
      eventSketches: FIRST_CAL_EVENTS,
    },
    secondCalConfig: {
      eventSketches: SECOND_CAL_EVENTS,
      primary: false,
    },
  });
});

add_task(async function test_mapi_calendar_owner() {
  await check_calView_with_multiple_calendars({
    configurator: MapiConfigurator,
    firstCalConfig: {
      eventSketches: FIRST_CAL_EVENTS,
    },
    secondCalConfig: {
      eventSketches: SECOND_CAL_EVENTS,
      owner: {
        name: "Someone Else",
        address: "someone@else.com",
      },
    },
  });
});
