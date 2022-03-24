/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/* globals WorkshopHelper, GapiConfigurator, MapiConfigurator */

"use strict";

/**
 * Validate calendar synchronization for the current day.
 */
async function check_links({ configurator, descriptions }) {
  const initialEventSketches = [];
  let i = 0;
  for (const description of descriptions) {
    const clone = Object.assign({}, description);
    delete clone.links;
    initialEventSketches.push({
      summary: `Test Event - Number ${i++}`,
      ...clone,
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

  const cmp = (x, y) => x.url.localeCompare(y.url);
  const calviewLinks = calView.items
    .map(event => event.links)
    .flat()
    .sort(cmp);
  const expectedLinks = descriptions
    .map(({ links }) => links)
    .flat()
    .sort(cmp);

  deepEqual(calviewLinks, expectedLinks);

  await WorkshopHelper.cleanBackend(workshopAPI);
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
  {
    description: `https://docs.google.com/document/d/foobar`,
    links: [
      {
        url: "https://docs.google.com/document/d/foobar",
        docInfo: {
          type: "document",
          title: "document: id is foobar",
        },
      },
    ],
  },
  {
    description: `https://docs.google.com/spreadsheets/d/raboof`,
    links: [
      {
        url: "https://docs.google.com/spreadsheets/d/raboof",
        docInfo: {
          type: "spreadsheets",
          title: "spreadsheets: id is raboof",
        },
      },
    ],
  },
  {
    description: `https://docs.google.com/spreadsheets/u/1/d/boofar`,
    links: [
      {
        url: "https://docs.google.com/spreadsheets/u/1/d/boofar",
        docInfo: {
          type: "spreadsheets",
          title: "spreadsheets: id is boofar",
        },
      },
    ],
  },
  {
    description: `https://drive.google.com/open?id=rafoob&authuser=0`,
    links: [
      {
        url: "https://drive.google.com/open?id=rafoob&authuser=0",
        docInfo: {
          type: "drive",
          title: "drive: id is rafoob",
        },
      },
    ],
  },
  {
    description: `https://docs.google.com/document/d/invalid`,
    links: [
      {
        url: "https://docs.google.com/document/d/invalid",
        docInfo: {
          type: "document",
          title: null,
        },
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
  // Other places with links and no description
  {
    description: "",
    onlineMeetingUrl: "http://mozilla.com",
    location: {
      displayName: "http://allizom.com",
    },
    locations: [
      {
        displayName: "http://allizom.org",
      },
    ],
    onlineMeeting: {
      joinUrl: "http://mozilla.org",
    },
    links: [
      { url: "http://mozilla.com/" },
      { url: "http://allizom.com/" },
      { url: "http://allizom.org/" },
      { url: "http://mozilla.org/" },
    ],
  },
  // Other places with links and with default description
  {
    onlineMeetingUrl: "http://mozilla.com",
    location: {
      displayName: "http://allizom.com",
    },
    locations: [
      {
        displayName: "http://allizom.org",
      },
    ],
    onlineMeeting: {
      joinUrl: "http://mozilla.org",
    },
    links: [
      { url: "http://mozilla.com/" },
      { url: "http://allizom.com/" },
      { url: "http://allizom.org/" },
      { url: "http://mozilla.org/" },
    ],
  },
  {
    description: `https://onedrive.live.com/edit?resid=foo&authkey=xlsx`,
    links: [
      {
        url: "https://onedrive.live.com/edit?resid=foo&authkey=xlsx",
        docInfo: {
          type: "ms-spreadsheet",
          title: "foo.xlsx",
        },
      },
    ],
  },
  {
    description: `https://1drv.ms/foo.js`,
    links: [
      {
        url: "https://1drv.ms/foo.js",
        docInfo: {
          type: "ms-drive",
          title: "foo.js",
        },
      },
    ],
  },
];

add_task(async function test_gapi_calendar_links_extraction() {
  await check_links({
    configurator: GapiConfigurator,
    descriptions: GAPI_DESCRIPTION_TEST,
  });
});

add_task(async function test_mapi_calendar_links_extraction() {
  await check_links({
    configurator: MapiConfigurator,
    descriptions: MAPI_DESCRIPTION_TEST,
  });
});
