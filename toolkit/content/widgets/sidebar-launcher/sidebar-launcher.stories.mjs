/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { html } from "../vendor/lit.all.mjs";
// eslint-disable-next-line import/no-unassigned-import
import "./sidebar-launcher.mjs";

export default {
  title: "UI Widgets/Sidebar Launcher",
  component: "sidebar-launcher",
  argTypes: {
    variant: {
      options: ["default", "other"],
      control: { type: "select" },
    },
  },
};

const Template = ({ variant }) => html`
  <sidebar-launcher .variant=${variant}></sidebar-launcher>
`;

export const Default = Template.bind({});
Default.args = {
  variant: "default",
};
