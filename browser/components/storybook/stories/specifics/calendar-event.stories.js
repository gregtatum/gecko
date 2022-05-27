/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { CalendarEvent } from "companion/widgets/calendar-event.js";
import { html } from "lit";

customElements.define("calendar-event", CalendarEvent);

export default {
  title: "Specifics/Companion/Calendar Event",
};

function makeDate({ addMinutes }) {
  let now = new Date();
  now.setMinutes(now.getMinutes() + addMinutes);
  return now;
}

const Template = ({ event }) =>
  html`
    <div class="card card-no-hover" style="padding: 0; max-width: 325px;">
      <calendar-event
        .event=${event}
        .setExtendedTimeout=${(...args) => setTimeout(...args)}
        .getLinkProperties=${link => ({ title: link.title || link.text })}
        .getDocumentIcon=${() =>
          "chrome://global/skin/icons/defaultFavicon.svg"}
      ></calendar-event>
    </div>
  `;

export const Default = Template.bind({});
Default.args = {
  event: {
    id: "some-id",
    serviceId: 1,
    summary: "GCal event",
    startDate: makeDate({ addMinutes: 10 }),
    endDate: makeDate({ addMinutes: 40 }),
    links: [
      {
        url: "https://example.com/notes",
        text: "Notes - GCal event",
      },
      {
        url: "https://mozilla.org/",
        text: "some links",
      },
      {
        url: "https://example.com/agenda",
        text: "Agenda",
        title: "Firefox Desktop Bi-Weekly Meeting - Google Docs",
      },
      {
        url: "https://example.com/ideas",
        title: "Project ideas - Google Docs",
      },
    ],
    conference: {
      icon: "chrome://browser/content/companion/zoom.svg",
      name: "Zoom",
      url: "https://example.com/zoom",
    },
    attendees: [
      {
        email: "you@example.com",
        responseStatus: "needsAction",
      },
      {
        email: "other@example.com",
        responseStatus: "needsAction",
      },
    ],
    organizer: {
      email: "me@example.com",
      self: true,
      isSelf: true,
    },
    creator: {
      email: "me@example.com",
      self: true,
      isSelf: true,
    },
    url: "https://example.com/calendar-event",
    isAllDay: false,
    calendar: {
      id: "primary",
    },
  },
};

export const Future = Template.bind({});
Future.args = {
  event: {
    ...Default.args.event,
    startDate: makeDate({ addMinutes: 120 }),
    endDate: makeDate({ addMinutes: 150 }),
  },
};

export const InProgress = Template.bind({});
InProgress.args = {
  event: {
    ...Default.args.event,
    startDate: makeDate({ addMinutes: -10 }),
  },
};

export const Finished = Template.bind({});
Finished.args = {
  event: {
    ...Default.args.event,
    startDate: makeDate({ addMinutes: -75 }),
    endDate: makeDate({ addMinutes: -10 }),
  },
};

export const TwoLinks = Template.bind({});
TwoLinks.args = {
  event: {
    ...Default.args.event,
    links: Default.args.event.links.slice(0, 2),
  },
};

export const OneLink = Template.bind({});
OneLink.args = {
  event: {
    ...Default.args.event,
    links: Default.args.event.links.slice(0, 1),
  },
};

export const NoLinks = Template.bind({});
NoLinks.args = {
  event: {
    ...Default.args.event,
    links: [],
  },
};
