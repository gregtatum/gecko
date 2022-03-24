/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/* globals DEFAULT_FAKE_NOW_TS, WorkshopHelper, GapiConfigurator */

"use strict";

/**
 * Validate calendar synchronization for the current day.
 */
async function check_links({ configurator, initialEventSketches }) {
  const initialEvents = WorkshopHelper.deriveFullEvents({
    eventSketches: initialEventSketches,
  });

  const oneMinute = 60 * 1000;
  for (const event of initialEventSketches) {
    event.startDate = new Date(event.startDate.valueOf() + oneMinute);
  }
  const changeEvents = WorkshopHelper.deriveFullEvents({
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

  const { error, account } = result;
  equal(error, null, "error is null");
  ok(account, "account is non-null");

  await account.syncFolderList();

  const calFolder = account.folders.getFirstFolderWithType("calendar");
  ok(calFolder, "have calendar folder");

  const spec = {
    kind: "calendar",
    filter: {
      refresh: true,
      tag: "",
      event: {
        type: "now",
        durationBeforeInMinutes: -1,
      },
    },
  };

  // ### View the contents of the folder in its entirety
  const calView = workshopAPI.searchAllMessages(spec);

  // ## Sync Tests Proper

  // ### Initially, there should be no events.
  calView.seekToTop(10, 990);
  WorkshopHelper.eventsEqual(calView.items, []);

  // ### Then we sync/refresh and we should have today's events.

  await Promise.all([calView.refresh(), calView.promisedOnce("seeked")]);

  // Once we got a "seeked", it means we've all the event in the view but a
  // refreshMetadata task has been triggered and it can be unfinished when
  // "seeked" happens.
  // Refresh to be sure we've everything.
  await workshopAPI.refreshAllMessages({
    kind: "calendar",
    filter: { tag: "" },
  });

  let title = calView.items.map(event => event.links[0].docInfo.title)[0];
  const expectedTitles = initialEventSketches.map(
    event => event.links[0].docInfo.titles
  )[0];

  deepEqual(title, expectedTitles[0]);

  fakeServer.defaultCalendar.changeEvents(changeEvents);
  fakeServer.invalidateCalendarTokens();
  fakeServer.changeSpecialTitle("special-1");

  await calView.refresh();
  await workshopAPI.refreshAllMessages({
    kind: "calendar",
    filter: { tag: "" },
  });

  title = calView.items.map(event => event.links[0].docInfo.title)[0];

  deepEqual(title, expectedTitles[1]);

  await WorkshopHelper.cleanBackend(workshopAPI);
}

const oneHour = 60 * 60 * 1000;
const INITIAL_EVENTS = [
  {
    summary: "Moving Meeting",
    description: `https://docs.google.com/document/d/special`,
    links: [
      {
        url: "https://docs.google.com/document/d/special",
        docInfo: {
          type: "document",
          titles: ["document: id is special-0", "document: id is special-1"],
        },
      },
    ],
    startDate: new Date(DEFAULT_FAKE_NOW_TS + 8 * oneHour),
    endDate: new Date(DEFAULT_FAKE_NOW_TS + 9 * oneHour),
  },
];

add_task(async function test_gapi_calendar_links_extraction() {
  await check_links({
    configurator: GapiConfigurator,
    initialEventSketches: INITIAL_EVENTS,
  });
});
