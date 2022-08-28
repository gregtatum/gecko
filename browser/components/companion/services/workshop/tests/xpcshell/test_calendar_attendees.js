/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/* globals WorkshopHelper, GapiConfigurator, MapiConfigurator */

"use strict";

/**
 * Validate event attendees.
 */
async function check_attendees({ configurator, initialEventSketches }) {
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

  const { error, account } = result;
  equal(error, null, "error is null");
  ok(account, "account is non-null");

  await account.syncFolderList();

  const calFolder = account.folders.getFirstFolderWithType("calendar");
  ok(calFolder, "have calendar folder");

  // ### View the contents of the folder in its entirety
  let calView = workshopAPI.viewFolderMessages(calFolder);

  calView.seekToTop(10, 990);
  WorkshopHelper.eventsEqual(calView.items, []);
  await calView.promisedOnce("seeked");

  const fieldNames = ["email", "displayName"];
  const extractor = a =>
    Object.fromEntries(fieldNames.map(name => [name, a[name]]));

  const calviewAttendees = calView.items.flatMap(({ attendees }) =>
    attendees.map(extractor)
  );
  const expectedAttendees = INITIAL_EVENTS.flatMap(({ attendees }) =>
    attendees.filter(a => a.responseStatus !== "declined").map(extractor)
  );

  if (configurator.name === "Gapi") {
    // Add the organizer as an attendee.
    expectedAttendees.push(INITIAL_EVENTS[0].organizer);
  }

  deepEqual(calviewAttendees, expectedAttendees);

  await WorkshopHelper.cleanBackend(workshopAPI);
}

const INITIAL_EVENTS = [
  {
    summary: "Morning Meeting",
    organizer: {
      displayName: "Hi Jee",
      email: "hjee@mozilla.com",
    },
    creator: {
      displayName: "Jay Kay",
      email: "jkay@mozilla.com",
    },
    attendees: [
      {
        displayName: "Ay Bee",
        email: "abee@mozilla.com",
        isSelf: true,
        isOrganizer: true,
        responseStatus: "accepted",
      },
      {
        displayName: "Cy Dee",
        email: "cdee@mozilla.com",
        responseStatus: "declined",
      },
      {
        displayName: "Hee Heff",
        email: "hheff@mozilla.com",
        responseStatus: "accepted",
      },
    ],
  },
];

add_task(async function test_gapi_calendar_attendees() {
  await check_attendees({
    configurator: GapiConfigurator,
    initialEventSketches: INITIAL_EVENTS,
  });
});

add_task(async function test_mapi_calendar_attendees() {
  await check_attendees({
    configurator: MapiConfigurator,
    initialEventSketches: INITIAL_EVENTS,
  });
});
