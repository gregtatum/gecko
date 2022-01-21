/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/* globals readFileData, WorkshopHelper, GapiConfigurator, MapiConfigurator */

"use strict";

/**
 * Validate unread message count for different apis.
 */
async function check_unread_message_count({
  configurator,
  setup,
  expectedCount,
  expectedWebLink,
}) {
  const fakeServer = await WorkshopHelper.createFakeServer({
    configurator,
  });
  await setup(fakeServer);

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

  const inboxSummaryFolder = account.folders.getFirstFolderWithType(
    "inbox-summary"
  );
  ok(inboxSummaryFolder, "have inbox-summary folder");

  await inboxSummaryFolder.refresh();
  await account.folders.promisedOnce("change");

  equal(
    inboxSummaryFolder.unreadMessageCount,
    expectedCount,
    "unreadMessageCount is correct"
  );

  equal(inboxSummaryFolder.webLink, expectedWebLink, "webLink is correct");
}

add_task(async function test_gapi_unread_message_count() {
  await check_unread_message_count({
    configurator: GapiConfigurator,
    setup: async server => {
      const feedPath = "test_gmail_feed.xml";
      const xmlStr = await readFileData(feedPath);
      server.setFeed(xmlStr);
    },
    expectedCount: 35826,
    expectedWebLink: null,
  });
});

add_task(async function test_mapi_unread_message_count() {
  const count = 31415926535;
  const webLink =
    "https://outlook.live.com/owa/?ItemID=A&exvsurl=1&viewmodel=ReadMessageItem";
  await check_unread_message_count({
    configurator: MapiConfigurator,
    setup: async server => {
      server.setUnreadMessageCount(count);
      server.setWeblink(webLink);
    },
    expectedCount: count,
    expectedWebLink: webLink.split("?", 1)[0],
  });
});
