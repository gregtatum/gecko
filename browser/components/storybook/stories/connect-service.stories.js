/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import "companion/widgets/connect-service.js";
import { html } from "lit";

const STATUS_TYPES = {
  disconnected: "disconnected",
  connected: "connected",
  error: "error",
  authenticating: "authenticating",
};

export default {
  title: "Specifics/Companion/Connect Service",
  argTypes: {
    status: {
      options: Object.keys(STATUS_TYPES),
      mapping: STATUS_TYPES,
      control: { type: "select" },
    },
  },
};

const Template = ({ icon, name, description, status }) =>
  html`
    <link
      rel="stylesheet"
      href="chrome://browser/content/companion/fonts.css"
    />
    <connect-service-notification
      .status=${status}
      .icon=${icon}
      .name=${name}
      .description=${description}
      .connectServiceCallback=${() => alert("Open connect page")}
    ></connect-service-notification>
  `;

export const Default = Template.bind({});
Default.args = {
  status: "disconnected",
  icon: "chrome://browser/content/companion/googleAccount.png",
  name: "Google Services",
  description: "Gmail, Calendar, Meet",
};
