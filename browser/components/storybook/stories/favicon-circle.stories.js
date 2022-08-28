/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import "companion/widgets/favicon-circle.js";
import { html } from "lit";

export default {
  title: "Design System/Atoms/Favicon Circle",
  argTypes: {
    size: {
      options: ["medium", "large"],
      control: { type: "radio" },
    },
  },
};

const Template = ({ src, size }) =>
  html`
    <link rel="stylesheet" href="chrome://global/skin/in-content/common.css" />
    <favicon-circle src=${src} size=${size} />
  `;

export const Default = Template.bind({});
Default.args = {
  src: "chrome://browser/content/companion/googleAccount.png",
  size: "medium",
};
