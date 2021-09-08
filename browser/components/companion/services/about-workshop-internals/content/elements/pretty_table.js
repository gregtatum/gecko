/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { css, LitElement } from "../lit_glue.js";

/**
 * Helper to flatten a hierarchical object structure to a single-depth table.
 * We know that the visual presentation will be one leaf node per row on the
 * right, with non-leaf nodes spanning multiple rows.
 */
class TableMaker {
  constructor() {
    /**
     * All the current non-leaf nodes.
     */
    this.curStack = [];
    this.maxDepth = 0;
    /**
     * All the leaf nodes, retained for fixup purposes.
     */
    this.leafNodes = [];

    this.curRow = null;
    this.root = document.createElement("table");
    this.root.setAttribute("class", "pda-data");
  }

  _ensureRow() {
    if (!this.curRow) {
      this.curRow = document.createElement("tr");
      this.root.appendChild(this.curRow);
    }
  }

  _emitRow(node) {
    this._ensureRow();
    this.curRow.appendChild(node);
    this.curRow = null;
  }

  _bumpRowUses() {
    for (const info of this.curStack) {
      info.useCount += 1;
      info.elem.rowSpan = info.useCount;
    }
  }

  pushKey(key) {
    const depth = this.curStack.length;

    const keyElem = document.createElement("td");
    keyElem.setAttribute("class", `pda-data-key pda-data-key-depth-${depth}`);
    keyElem.textContent = key;

    this._ensureRow();
    this.curRow.appendChild(keyElem);

    this.curStack.push({
      elem: keyElem,
      // rowSpan starts at 1, but we want it to start at 0, so we maintain our
      // own separate useCount here.
      useCount: 0,
    });
    this.maxDepth = Math.max(this.curStack.length, this.maxDepth);
  }

  popKey() {
    this.curStack.pop();
  }

  /**
   * Emit a leaf value, which means writing out the cell and finishing the row.
   * It's at this point that we adjust rowSpans.
   */
  emitLeaf(value) {
    const valueElem = document.createElement("td");
    valueElem.textContent = JSON.stringify(value, null, 2);
    valueElem.classList.add("pda-data-value");
    this.leafNodes.push({ depth: this.curStack.length, elem: valueElem });
    this._bumpRowUses();
    this._emitRow(valueElem);
  }

  finalize() {
    for (const leaf of this.leafNodes) {
      leaf.elem.colSpan = this.maxDepth - leaf.depth + 1;
    }

    return this.root;
  }
}

function formatData(key, value) {
  if (key.toLowerCase().includes("date")) {
    try {
      value = new Date(value).toString();
    } catch {}
  }
  return value;
}

/**
 * More layout-friendly version that builds a single table using the above
 * TableMaker.
 */
function prettifyData(dataRoot) {
  const tableMaker = new TableMaker();

  function traverse(data) {
    if (!data) {
      tableMaker.emitLeaf(data);
      return;
    }

    let keyCount = 0;
    for (let [key, value] of Object.entries(data)) {
      keyCount++;

      tableMaker.pushKey(key);
      value = formatData(key, value);

      if (typeof value === "object") {
        traverse(value);
      } else {
        tableMaker.emitLeaf(value);
      }

      tableMaker.popKey();
    }

    // This could have been an empty object, in which case we want to emit an
    // empty object.
    if (keyCount === 0) {
      tableMaker.emitLeaf(data);
    }
  }
  traverse(dataRoot);

  return tableMaker.finalize();
}

/**
 * Renders JSON-ish objects as a icicle-visualization styled table.  Pass
 * immediately available JS objects for display via the `data` property or
 * JSON-strings (that need to be parsed) in Blobs via `jsonBlob`.
 */
export class PrettyTable extends LitElement {
  static get properties() {
    return {
      data: { type: Object },
      jsonBlob: { type: Object },
    };
  }

  static get styles() {
    return css`
      :host {
        display: block;
      }

      .pd {
        display: block;
        border: 1px solid gray;
        margin: 2px;
        margin-left: 0.5em;
        padding: 2px;
      }
      .pda-container {
        display: inline-block;
        border: 1px solid #888;
        background-color: #eee;
        margin: 0 4px;
      }
      .pda-focus {
        margin: 0 4px;
        font-style: italic;
      }
      .pda-nightmare-data {
        display: grid;
        grid-template-columns: 120px 1fr;
        border-bottom: 1px solid white;
      }
      .pda-data-key-depth-0 {
        background-color: #eeeeee;
      }
      .pda-data-key-depth-1 {
        background-color: #e8e8e8;
      }
      .pda-data-key-depth-2 {
        background-color: #dddddd;
      }
      .pda-data-key-depth-3 {
        background-color: #d8d8d8;
      }
      .pda-data-key-depth-4 {
        background-color: #cccccc;
      }
      .pda-data-key-depth-5 {
        background-color: #c8c8c8;
      }
      .pda-data-key-depth-6,
      .pda-data-key-depth-7,
      .pda-data-key-depth-8 {
        background-color: #bbbbbb;
      }
      .pda-data-value {
        background-color: #fff;
      }
      .pda-kv-pair {
        margin: 0 4px;
      }

      .pd-tag {
        font-size: 80%;
        border: 1px solid #ccc;
        margin-right: 2px;
        vertical-align: top;
        font-family: sans-serif;
      }

      .pd-str {
        border: 1px dashed gray;
      }

      /* pml color schemes, to potentially use for pml-style rendering */
      .pd0 {
        background-color: #eff;
      }
      .pd1 {
        background-color: #fef;
      }
      .pd2 {
        background-color: #ffe;
      }
      .pd3 {
        background-color: #eef;
      }
      .pd4 {
        background-color: #efe;
      }
      .pd5 {
        background-color: #fee;
      }
      .pd6 {
        background-color: #dff;
      }
      .pd7 {
        background-color: #fdf;
      }
      .pd8 {
        background-color: #ffd;
      }
      .pd9 {
        background-color: #ddf;
      }
      .pd10 {
        background-color: #dfd;
      }
      .pd11 {
        background-color: #fdd;
      }
    `;
  }

  willUpdate(changedProperties) {
    if (changedProperties.has("jsonBlob")) {
      this.getBlobContents();
    }
  }

  async getBlobContents() {
    const jsonStr = await this.jsonBlob.text();
    this.data = JSON.parse(jsonStr);
  }

  render() {
    return prettifyData(this.data);
  }
}
customElements.define("awi-pretty-table", PrettyTable);
