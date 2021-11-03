/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/* globals readFileData, WorkshopHelper */

"use strict";

async function check_parser(parserType, url, sourcePath, expectedJsonPath) {
  const workshopAPI = await WorkshopHelper.startBackend({});
  const xmlStr = await readFileData(sourcePath);

  let feed = await workshopAPI.TEST_parseFeed(parserType, xmlStr, url);
  feed = JSON.parse(JSON.stringify(feed));

  let expected = await readFileData(expectedJsonPath);
  expected = JSON.parse(expected);

  Assert.deepEqual(expected, feed);
}

add_task(async function test_check_rss_parser() {
  await check_parser("rss", "", "test_rss.xml", "test_rss_expected.json");
});

add_task(async function test_check_atom_parser() {
  await check_parser("rss", "", "test_atom.xml", "test_atom_expected.json");
});

add_task(async function test_check_hfeed_parser() {
  await check_parser(
    "hfeed",
    "https://www.allizom.org",
    "test_hfeed.html",
    "test_hfeed_expected.json"
  );
});

add_task(async function test_check_jsonfeed_parser() {
  await check_parser(
    "jsonfeed",
    "",
    "test_jsonfeed.json",
    "test_jsonfeed_expected.json"
  );
});
