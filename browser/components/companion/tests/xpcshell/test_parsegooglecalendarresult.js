/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { parseGoogleCalendarResult } = ChromeUtils.import(
  "resource:///modules/OnlineServicesHelper.jsm"
);

const htmlLink = "https://calendar.google.com/calendar/somekey";
const creatorEmail = "creator@example.com";

const GOOGLE_TEST = [
  {
    result: {
      organizer: {
        email: "organizer@example.com",
      },
      creator: {
        email: creatorEmail,
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
      htmlLink,
      location: "https://example.zoom.us/12345678,Not part of URL",
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
      url: `${htmlLink}?authuser=${encodeURIComponent(creatorEmail)}`,
      conference: "https://example.zoom.us/12345678",
    },
  },
];

add_task(async function test_parseGoogleCalendarResult() {
  for (let test of GOOGLE_TEST) {
    let event = parseGoogleCalendarResult(test.result, creatorEmail);
    deepEqual(event.attendees, test.test_result.attendees);
    equal(event.creator.isSelf, true);
    equal(event.url, test.test_result.url);
    equal(event.conference.url, test.test_result.conference);
  }
});
