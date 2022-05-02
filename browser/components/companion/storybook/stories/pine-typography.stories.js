/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { html, LitElement, css } from "companion/lit.all.js";

export default {
  title: "Design System/Foundation/Typography",
};

const HEADING_CLASSES = [
  "text-heading-l-semibold",
  "text-heading-m-semibold",
  "text-heading-m-med",
  "text-heading-s",
];

const BODY_CLASSES = [
  "text-body-l-med",
  "text-body-m-bold",
  "text-body-m-med",
  "text-body-m",
  "text-body-s-med",
  "text-body-s",
  "text-body-xs",
];

export const Default = () => html`
  <link rel="stylesheet" href="chrome://browser/content/companion/fonts.css" />
  <div>
    <type-styles-table
      .classNames=${HEADING_CLASSES}
      .title=${"Heading"}
    ></type-styles-table>
    <type-styles-table
      .classNames=${BODY_CLASSES}
      .title=${"Body"}
    ></type-styles-table>
  </div>
`;

class TypeStylesTable extends LitElement {
  static get properties() {
    return {
      classNames: { type: Array },
      title: { type: String },
      styleProps: { type: Object },
    };
  }

  static get styles() {
    return css`
      @import url("chrome://browser/content/companion/fonts.css");
      .container {
        max-width: 700px;
        min-width: 600px;
      }

      table {
        table-layout: auto;
        border-collapse: collapse;
        border: 1px solid lightgray;
        text-align: center;
        width: 100%;
      }

      tr {
        border-bottom: 1px solid lightgray;
      }

      th,
      td {
        padding: 0 16px;
        width: 25%;
      }

      td {
        height: 48px;
      }

      th {
        height: 36px;
        font-size: 12px;
        text-transform: uppercase;
        font-weight: 600;
        background: rgba(211, 211, 211, 0.2);
      }

      th:first-of-type,
      td:first-of-type {
        text-align: start;
        max-width: fit-content;
        white-space: nowrap;
      }

      p {
        margin: 0;
        width: fit-content;
      }
    `;
  }

  constructor() {
    super();
    this.styleProps = {};
    this.stylesTimeout = null;
  }

  firstUpdated() {
    this.handleReadStyles();
  }

  handleReadStyles() {
    for (let className of this.classNames) {
      const element = this.renderRoot.querySelector(`.${className}`);
      const styles = window.getComputedStyle(element);
      // getting incorrect values for lineheight on storybook startup
      if (!styles.lineHeight || styles.lineHeight === "normal") {
        this.stylesTimeout = setTimeout(() => {
          this.stylesTimeout = null;
          this.handleReadStyles();
        }, 100);
        return;
      }
      this.styleProps[className] = {
        fontSize: styles.fontSize,
        fontWeight: styles.fontWeight,
        lineHeight: `${Math.ceil(styles.lineHeight.split("px")[0])}px`,
      };
    }
    this.requestUpdate();
  }

  render() {
    return html`
      <div class="container">
        <h3>${this.title}</h3>
        <table>
          <thead>
            <tr>
              <th>Class</th>
              <th>Size</th>
              <th>Weight</th>
              <th>Line Height</th>
            </tr>
          </thead>
          <tbody>
            ${this.classNames.map(
              className =>
                html`
                  <tr>
                    <td><p class=${className}>${className}</p></td>
                    <td>
                      ${this.styleProps[className]?.fontSize || "..."}
                    </td>
                    <td>
                      ${this.styleProps[className]?.fontWeight || "..."}
                    </td>
                    <td>
                      ${this.styleProps[className]?.lineHeight || "..."}
                    </td>
                  </tr>
                `
            )}
          </tbody>
        </table>
      </div>
    `;
  }
}
customElements.define("type-styles-table", TypeStylesTable);
