/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { css, html, styleMap, LitElement } from "../lit_glue.js";

/**
 * An attempt at a mouse-based splitter.  Layout is handled by making all
 * children absolutely positioned and manually laying things out.
 *
 * Inspiration is taken from the MIT-licensed
 * https://github.com/tomkp/react-split-pane which I've worked with previously,
 * but the focus here is on the bare minimum.
 *
 * Current simplifications:
 * - Horizontal-only!
 */
export class Splitter extends LitElement {
  static get properties() {
    return {
      // Which side should be the part that gets the benefit of any new pixels.
      // If this is "left" then the offset is relative to the right-side of the
      // container.  If this is "right" then the offset is relative to the left
      // side of the container.
      flex: { type: String },
      // What should the initial offset be if we don't have any persisted data
      // for what the user wants.  (Noting that we currently don't persist
      // anything... but we could!)
      initial: { type: Number },
      // boolean tracking if we're actively resizing because the mouse is down.
      resizing: { state: true },
      offset: { state: true },
    };
  }

  static get styles() {
    return css`
      :host {
        display: block;
        position: relative;
        overflow: hidden;
        height: 100%;
        width: 100%;
      }

      #left,
      #right {
        position: absolute;
        top: 0;
        height: 100%;
        overflow: auto;
      }

      #resizer {
        position: absolute;
        top: 0;
        z-index: 100;
        width: 5px;
        height: 100%;
        background-color: lightgray;
        cursor: col-resize;
      }

      #resizer.resizing {
        background-color: blue;
      }
    `;
  }

  constructor() {
    super();

    this.resizing = false;
    this.offset = 0;

    this.lastX = null;

    // XXX The template @event magic effectively binds/curries `this`, and I'm
    // assuming it doesn't auto-bind every method on every instance.  But if it
    // is, this is redundant.
    this._bound_onMouseMove = this.onMouseMove.bind(this);
    this._bound_onMouseUp = this.onMouseUp.bind(this);
  }

  connectedCallback() {
    super.connectedCallback();

    this.offset = this.initial;

    document.addEventListener("mousemove", this._bound_onMouseMove);
    document.addEventListener("mouseup", this._bound_onMouseUp);
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    document.removeEventListener("mousemove", this._bound_onMouseMove);
    document.removeEventListener("mouseup", this._bound_onMouseUp);
  }

  onMouseDown(evt) {
    evt.preventDefault();
    this.resizing = true;
    this.lastX = evt.clientX;
  }

  onMouseMove(evt) {
    if (!this.resizing) {
      return;
    }

    evt.preventDefault();
    const delta = this.lastX - evt.clientX;
    this.offset += delta;
    this.lastX = evt.clientX;
  }

  onMouseUp(evt) {
    if (!this.resizing) {
      return;
    }

    evt.preventDefault();
    this.resizing = false;
    this.lastX = null;
  }

  render() {
    const leftStyle = {};
    const resizerStyle = {};
    const rightStyle = {};

    const halfResizer = 2;

    if (this.flex === "left") {
      leftStyle.left = "0";
      leftStyle.right = `${this.offset + halfResizer}px`;

      resizerStyle.right = "0";
      resizerStyle.transform = `translate(-${this.offset - halfResizer}px)`;

      rightStyle.width = `${this.offset - halfResizer}px`;
      rightStyle.right = "0";
    }

    return html`
      <div id="left" style=${styleMap(leftStyle)}>
        <slot name="left" />
      </div>
      <div
        id="resizer"
        style=${styleMap(resizerStyle)}
        @mousedown=${this.onMouseDown}
        @mousemove=${this.onMouseMove}
        @mouseup=${this.onMouseUp}
      ></div>
      <div id="right" style=${styleMap(rightStyle)}>
        <slot name="right" />
      </div>
    `;
  }
}
customElements.define("awi-splitter", Splitter);
