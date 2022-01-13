/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/* globals WorkshopHelper, GapiConfigurator, MapiConfigurator */

"use strict";

/**
 * Validate calendar synchronization for the current day.
 */
async function check_links_extracted_from_description({
  configurator,
  descriptions,
}) {
  const initialEventSketches = [];
  let i = 0;
  for (const { description, descriptionType } of descriptions) {
    initialEventSketches.push({
      summary: `Test Event - Number ${i++}`,
      description,
      descriptionType,
    });
  }
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
  const calviewLinks = calView.items.map(event => event.links).reverse();
  const expectedLinks = descriptions.map(({ links }) => links);

  deepEqual(calviewLinks, expectedLinks);
}

const GAPI_DESCRIPTION_TEST = [
  {
    description: `https://www.yahoo.com`,
    links: [{ url: "https://www.yahoo.com/" }],
  },
  {
    description: `<a href="/">https://example.com/path</a>`,
    links: [{ url: "https://example.com/path" }],
  },
  {
    description: `<a href="https://www.example.com">text</a>`,
    links: [{ url: "https://www.example.com/", text: "text" }],
  },
  {
    description: `https://aka.ms/JoinTeamsMeeting`,
    links: [],
  },
  {
    description: `
      <a href="http://example.com">An example</a>
      Some other text
      http://www.yahoo.com
      Strange markup<https://mysettings.lync.com/pstnconferencing>
    `,
    links: [
      { url: "http://example.com/", text: "An example" },
      { url: "http://www.yahoo.com/" },
      { url: "https://mysettings.lync.com/pstnconferencing" },
    ],
  },
  {
    description: `<div>
      <p>Should de-dupe links:</p>
      <br/>
      <a href="https://example.com">https://example.com</a>
      <a href="https://example.com">https://example.com</a>
      <p>Consectetur adipiscing elit:</p>
      <br/>
      <a href="https://example.com/different">Click here</a>
      <p>Fusce eget eleifend nunc:</p>
      <br/>
      <a href="https://www.something.ca">https://www.something.ca</a>
    </div>`,
    links: [
      { url: "https://example.com/", text: "https://example.com" },
      { url: "https://example.com/different", text: "Click here" },
      { url: "https://www.something.ca/", text: "https://www.something.ca" },
    ],
  },
  // tel: links should be ignored
  {
    description: `tel:123456789`,
    links: [],
  },
  // href value differs from the link text, but both can be parsed as valid URLs
  {
    description: `<a href="https://docs.google.com/key">https://docs.google.com/blah</a>`,
    links: [
      {
        url: "https://docs.google.com/key",
        text: "https://docs.google.com/blah",
      },
    ],
  },
];

const MAPI_DESCRIPTION_TEST = [
  // For Microsoft events, only HTML is parsed, not text.
  {
    description: `<html><a href="https://example.org">Example</a>https://example.com</html>`,
    descriptionType: "html",
    links: [{ url: "https://example.org/", text: "Example" }],
  },
  // Strange Microsoft markup only shows proper HTML links.
  {
    description: `
        <a href="http://example.com">An example</a>
        Some other text
        http://www.yahoo.com
        Strange markup<https://mysettings.lync.com/pstnconferencing>
      `,
    descriptionType: "html",
    links: [{ url: "http://example.com/", text: "An example" }],
  },
];

add_task(async function test_gapi_calendar_links_extraction() {
  await check_links_extracted_from_description({
    configurator: GapiConfigurator,
    descriptions: GAPI_DESCRIPTION_TEST,
  });
});

add_task(async function test_mapi_calendar_links_extraction() {
  await check_links_extracted_from_description({
    configurator: MapiConfigurator,
    descriptions: MAPI_DESCRIPTION_TEST,
  });
});
