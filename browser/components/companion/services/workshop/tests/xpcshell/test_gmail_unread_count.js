/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/* globals readFileData, WorkshopHelper, GapiConfigurator */

"use strict";

/**
 * Validate calendar synchronization for the current day.
 */
async function check_gmail_feed_fullcount({ configurator, feedPath }) {
  const xmlStr = await readFileData(feedPath);
  const fakeServer = await WorkshopHelper.createFakeServer({
    configurator,
  });

  fakeServer.setFeed(xmlStr);

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
    "35826",
    "unreadMessageCount is correct"
  );
}

add_task(async function test_gmail_feed_fullcount() {
  await check_gmail_feed_fullcount({
    configurator: GapiConfigurator,
    feedPath: "test_gmail_feed.xml",
  });
});
