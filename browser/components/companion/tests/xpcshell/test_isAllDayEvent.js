/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { isAllDayEvent } = ChromeUtils.import(
  "resource:///modules/OnlineServicesHelper.jsm"
);

add_task(async function test_isAllDayEventResult() {
  let start = new Date();
  start.setHours(18);
  let end = new Date(start);

  // Test event that's less than 12 hours
  end.setHours(start.getHours() + 1);
  equal(isAllDayEvent(start, end), false);

  // Test event that spans 12 hours
  end.setHours(start.getHours() + 12);
  equal(isAllDayEvent(start, end), true);

  // Test event that spans multiple days
  end.setHours(start.getHours() + 48, 30);
  equal(isAllDayEvent(start, end), true);
});
