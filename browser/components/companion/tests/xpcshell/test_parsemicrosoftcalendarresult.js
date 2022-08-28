/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { parseMicrosoftCalendarResult } = ChromeUtils.import(
  "resource:///modules/OnlineServicesHelper.jsm"
);

const MICROSOFT_TEST = [
  {
    result: {
      organizer: {
        emailAddress: {
          name: "Organizer",
          address: "organizer@example.com",
        },
      },
      attendees: [
        {
          emailAddress: {
            name: "Declined",
            address: "declined@example.com",
          },
          status: {
            response: "declined",
          },
        },
        {
          emailAddress: {
            name: "None",
            address: "none@example.com",
          },
          status: {
            response: "none",
          },
        },
        {
          emailAddress: {
            name: "Tentatively Accepted",
            address: "tentativelyAccepted@example.com",
          },
          status: {
            response: "tentativelyAccepted",
          },
        },
        {
          emailAddress: {
            name: "Accepted",
            address: "accepted@example.com",
          },
          status: {
            response: "accepted",
          },
        },
      ],
    },
    test_result: {
      attendees: [
        {
          name: "None",
          email: "none@example.com",
          isSelf: false,
        },
        {
          name: "Tentatively Accepted",
          email: "tentativelyAccepted@example.com",
          isSelf: false,
        },
        {
          name: "Accepted",
          email: "accepted@example.com",
          isSelf: false,
        },
      ],
    },
  },
];

add_task(async function test_parseMicrosoftCalendarResult() {
  for (let test of MICROSOFT_TEST) {
    let event = parseMicrosoftCalendarResult(test.result);
    deepEqual(event.attendees, test.test_result.attendees);
  }
});
