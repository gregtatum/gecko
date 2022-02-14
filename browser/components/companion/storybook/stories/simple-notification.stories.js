/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import "companion/widgets/simple-notification.js";
import { html } from "companion/lit.all.js";

export default {
  title: "Design System/Components/Simple Notification",
};

const Template = ({ icon, heading, description, buttonLabel, buttonClass }) =>
  html`
    <simple-notification
      .icon=${icon}
      .heading=${heading}
      .description=${description}
    >
      ${buttonClass && buttonLabel
        ? html`
            <button slot="primary-button" class=${buttonClass}>
              ${buttonLabel}
            </button>
          `
        : ""}
    </simple-notification>
  `;

export const Default = Template.bind({});
Default.args = {
  icon: "chrome://browser/content/companion/mozsocial.png",
  heading: "Notification Header",
  description: "Lorem ipsum dolor sit amet, consectetur adipiscing.",
};

export const WithButton = Template.bind({});
WithButton.args = {
  ...Default.args,
  buttonClass: "primary",
  buttonLabel: "Visit",
};
