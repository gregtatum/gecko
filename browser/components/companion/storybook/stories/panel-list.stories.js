/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import "toolkit-widgets/panel-list.js";
import { html } from "companion/lit.all.js";

export default {
  title: "Design System/Components/Panel Menu",
};

const openMenu = e => document.querySelector("panel-list").toggle(e);

const Template = ({ open, items }) =>
  html`
    <link rel="stylesheet" href="chrome://global/skin/in-content/common.css" />
    <style>
      panel-item[icon="google"]::part(button) {
        background-image: url("chrome://browser/content/companion/googleAccount.png");
      }
      panel-item[icon="outlook"]::part(button) {
        background-image: url("chrome://browser/content/companion/microsoft365.ico");
      }
    </style>
    <button @click=${openMenu}>Toggle</button>
    <button @click=${openMenu}>Toggle</button>
    <button @click=${openMenu}>Toggle</button>
    <panel-list ?open=${open}>
      ${items.map(
        i => html`
          <panel-item icon=${i.icon ?? ""} ?checked=${i.checked}>
            ${i.text ?? i}
          </panel-item>
        `
      )}
    </panel-list>
  `;

export const Simple = Template.bind({});
Simple.args = {
  open: false,
  items: [
    "Item One",
    "Item Two",
    "Item Three",
    { text: "Checked", checked: true },
  ],
};

export const Icons = Template.bind({});
Icons.args = {
  open: false,
  items: [
    {
      text: "Google",
      icon: "google",
    },
    {
      text: "Outlook",
      icon: "outlook",
    },
  ],
};
