/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

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

export class PrettyTable extends HTMLElement {
  constructor(data) {
    super();

    const elem = prettifyData(data);
    this.appendChild(elem);
  }
}
customElements.define("awi-pretty-table", PrettyTable);
