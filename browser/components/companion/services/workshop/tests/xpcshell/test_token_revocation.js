/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/* globals WorkshopHelper, GapiConfigurator, MapiConfigurator */

"use strict";

/**
 * Check that token revocation surfaces some issues in the account view.
 */
async function check_token_revocation_for_account_type({
  configurator,
  initialEventSketches,
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

  const calFolder = account.folders.getFirstFolderWithType("calendar");
  ok(calFolder, "have calendar folder");

  // ### View the contents of the folder in its entirety
  let calView = workshopAPI.viewFolderMessages(calFolder);

  // ## Support Code
  // Everything in here is just boilerplate from other tests to get us
  // synchronized data so we can insert errors.
  calView.seekToTop(10, 990);
  WorkshopHelper.eventsEqual(calView.items, []);
  await calView.promisedOnce("seeked");
  WorkshopHelper.eventsEqual(calView.items, initialEvents);

  // ## Actual Problem Testing
  const eventAfterErrors = WorkshopHelper.deriveFullEvents({
    eventSketches: errors.slice(1),
  });

  // We push a critical error so next refresh must get the error and
  // consequently all subsequent refreshs must not work until we add a new token
  // to the account.
  fakeServer.defaultCalendar.addEvents(eventAfterErrors);
  fakeServer.addErrors(errors.slice(0, 1));

  await Promise.all([account.promisedOnce("problems"), calView.refresh()]);

  // Check that the events added just before the error are not in the view.
  WorkshopHelper.eventsEqual(calView.items, initialEvents);

  let problems = account.problems;
  ok(problems, "We must have a problem");
  ok(problems.credentials, "Credentials issue");

  const currentEvents = [...initialEvents, ...eventAfterErrors];
  await account.modifyAccount({
    oauthTokens: {
      accessToken: "a token",
    },
  });

  await Promise.all([account.promisedOnce("problems"), calView.refresh()]);

  WorkshopHelper.eventsEqual(calView.items, currentEvents);

  problems = account.problems;
  ok(!problems, "No more problems");
}

const INITIAL_EVENTS = [
  {
    summary: "Morning Meeting",
  },
  {
    summary: "Coffee Meeting",
  },
];

const ERRORS = [
  {
    code: 401,
    message: "Invalid Credentials",
  },
  {
    summary: "Burn a log",
  },
  {
    summary: "Burn an other log",
  },
];

add_task(async function test_gapi_calendar_token_revocation() {
  await check_token_revocation_for_account_type({
    configurator: GapiConfigurator,
    initialEventSketches: INITIAL_EVENTS,
    errors: ERRORS.slice(),
  });
});

add_task(async function test_mapi_calendar_token_revocation() {
  await check_token_revocation_for_account_type({
    configurator: MapiConfigurator,
    initialEventSketches: INITIAL_EVENTS,
    errors: ERRORS.slice(),
  });
});
