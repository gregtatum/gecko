/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/* globals WorkshopHelper, GapiConfigurator, MapiConfigurator */

"use strict";

/**
 * Validate calendar synchronization for the current day.
 */
async function check_account_creation_for_type({
  configurator,
  initialEventSketches,
  addEventSketches,
  changeEventSketches,
  errors,
}) {
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

  const calView = workshopAPI.searchAllMessages({
    kind: "calendar",
    filter: {
      tag: "",
      event: {
        type: "now",
        durationBeforeInMinutes: -1,
      },
    },
  });
  calView.seekToTop(10, 990);

  await Promise.all([
    account.fillEmptyAccount(),
    calView.promisedOnce("seeked"),
  ]);

  WorkshopHelper.eventsEqual(calView.items, initialEvents);
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

add_task(async function test_gapi_account_creation() {
  await check_account_creation_for_type({
    configurator: GapiConfigurator,
    initialEventSketches: INITIAL_EVENTS,
  });
});

add_task(async function test_mapi_account_creation() {
  await check_account_creation_for_type({
    configurator: MapiConfigurator,
    initialEventSketches: INITIAL_EVENTS,
  });
});
