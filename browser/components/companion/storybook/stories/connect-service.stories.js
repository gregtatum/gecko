/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import "companion/widgets/connect-service.js";
import { html } from "companion/lit.all.js";

export default {
  title: "Specifics/Companion/Connect Service",
};

const Template = ({ authenticating, connected, icon, name, services }) =>
  html`
    <connect-service-notification
      .authenticating=${authenticating}
      .connected=${connected}
      .icon=${icon}
      .name=${name}
      .services=${services}
      .connectServiceCallback=${() => alert("Open connect page")}
    ></connect-service-notification>
  `;

export const Default = Template.bind({});
Default.args = {
  authenticating: false,
  connected: false,
  icon: "chrome://browser/content/companion/googleAccount.png",
  name: "Google Services",
  services: "Gmail, Calendar, Meet",
};
