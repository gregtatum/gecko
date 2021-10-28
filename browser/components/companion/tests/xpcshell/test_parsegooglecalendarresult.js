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
        email: "email@example.com",
      },
      creator: {
        email: "email@example.com",
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
  },
];

add_task(async function test_parseGoogleCalendarResult() {
  for (let test of GOOGLE_TEST) {
    let event = parseGoogleCalendarResult(test.result, "email@example.com");
    deepEqual(
      event.attendees,
      test.result.attendees.filter(a => a.responseStatus !== "declined")
    );
    equal(event.organizer.isSelf, true);
    equal(event.creator.isSelf, true);
  }
});
