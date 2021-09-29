/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

export const timeFormat = new Intl.DateTimeFormat([], {
  timeStyle: "short",
});

export const dateFormat = new Intl.DateTimeFormat([], {
  dateStyle: "short",
});

export function timeSince(date) {
  let DAY_IN_MS = 1000 * 60 * 60 * 24;
  let seconds = Math.floor((new Date() - date) / 1000);
  let minutes = Math.floor(seconds / 60);

  if (minutes <= 0) {
    return "Just now";
  }
  let hours = Math.floor(minutes / 60);
  if (hours <= 0) {
    return minutes + "m ago";
  }

  let today = new Date();
  today.setHours(0, 0, 0, 0);

  // Take the day into account when we handle hours, if
  // something happened 6 hours ago but its 3AM, it happened
  // yesterday. This doesnt happen with minutes.
  if (hours < 24 && date > today) {
    return hours + "hr ago";
  }

  let midnight = new Date(date);
  midnight.setHours(0, 0, 0, 0);

  // Once we are measuring days we only care about what day it
  // is not the time that it occured (2 days ago is the whole
  // of the day)
  let daysDiff = today - midnight;
  let days = Math.floor(daysDiff / DAY_IN_MS);

  if (days == 1) {
    return "yesterday";
  }

  let weeks = Math.floor(days / 7);

  if (weeks <= 0) {
    return days + " days ago";
  }

  return weeks + " week" + (weeks == 1 ? "" : "s") + " ago";
}
