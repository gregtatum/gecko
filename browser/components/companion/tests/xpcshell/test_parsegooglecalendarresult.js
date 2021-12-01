/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { parseGoogleCalendarResult } = ChromeUtils.import(
  "resource:///modules/OnlineServicesHelper.jsm"
);

const GOOGLE_TEST = [
  {
    result: {
      organizer: {
        email: "organizer@example.com",
      },
      creator: {
        email: "creator@example.com",
      },
      attendees: [
        {
          email: "declined@example.com",
          responseStatus: "declined",
        },
        {
          email: "needsAction@example.com",
          responseStatus: "needsAction",
        },
        {
          email: "tentative@example.com",
          responseStatus: "tentative",
        },
        {
          email: "accepted@example.com",
          responseStatus: "accepted",
        },
      ],
    },
    test_result: {
      attendees: [
        {
          email: "needsAction@example.com",
          responseStatus: "needsAction",
        },
        {
          email: "tentative@example.com",
          responseStatus: "tentative",
        },
        {
          email: "accepted@example.com",
          responseStatus: "accepted",
        },
        {
          email: "organizer@example.com",
        },
      ],
    },
  },
];

add_task(async function test_parseGoogleCalendarResult() {
  for (let test of GOOGLE_TEST) {
    let event = parseGoogleCalendarResult(test.result, "creator@example.com");
    deepEqual(event.attendees, test.test_result.attendees);
    equal(event.creator.isSelf, true);
  }
});
