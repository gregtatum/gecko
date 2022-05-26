/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import "companion/widgets/action-button.js";
import { html } from "companion/lit.all.js";

const ICON_TYPES = {
  Pin: "chrome://browser/skin/pin-12.svg",
  Close: "chrome://global/skin/icons/close.svg",
  Mute: "chrome://global/skin/media/audio-muted.svg",
  More: "chrome://global/skin/icons/more.svg",
};

export default {
  title: "Design System/Components/Action Button",
  argTypes: {
    icon: {
      options: Object.keys(ICON_TYPES),
      mapping: ICON_TYPES,
      control: { type: "select" },
    },
  },
};
const Template = ({ icon, label, disabled }) =>
  html`
    <link
      rel="stylesheet"
      href="chrome://browser/content/companion/fonts.css"
    />
    <action-button
      .icon=${icon}
      .label=${label}
      .disabled=${disabled}
    ></action-button>
  `;

export const Default = Template.bind({});
Default.args = {
  disabled: false,
  icon: "Pin",
  label: "snapshot-group-pinned-header",
};

export const Disabled = Template.bind({});
Disabled.args = {
  disabled: true,
  icon: "More",
  label: "companion-event-document-and-links",
};
