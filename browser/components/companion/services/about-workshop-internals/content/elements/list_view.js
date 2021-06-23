/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Dynamically renders and updates the contents of the provided
 * `WindowedListView` or `EntireListView` instance when provided with a
 * custom element constructor that obeys the following contract:
 * - The constructor takes an argument which is the Workshop Object to be
 *   rendered.
 * - The custom element exposes an `update` method.  This will be invoked after
 *   inserting the element into the DOM.
 */
export class ListView extends HTMLElement {
  constructor(listView, elementConstructor) {
    super();

    this.listView = listView;
    this.elementConstructor = elementConstructor;

    // Maps the Workshop reps from listView.items to { elem, serial }
    // characterizing the last rendered serial for the given object.
    this.itemToInfo = new Map();
  }

  connectedCallback() {
    if (!this.isConnected) {
      return;
    }

    if (this.listView.viewKind === "entire") {
      this.listView.on("complete", this, this.update);
    } else {
      // Ask for a thousand of whatever there is.  The goal here is to act like
      // we're dealing with an EntireListView because we're expecting a number
      // of results that's less than a thousand.  In the event we're wrong,
      // a thousand is still sufficiently overwhelming for humans without
      // being completely overwhelming to the browser.
      this.listView.seekToTop(10, 990);
      this.listView.on("seeked", this, this.update);
    }

    // Render what we already have.
    this.update();
  }

  disconnectedCallback() {
    if (this.listView.viewKind === "entire") {
      this.listView.removeListener("complete", this, this.update);
    } else {
      this.listView.removeListener("seeked", this, this.update);
    }
  }

  /**
   * Update the children of this element to reflect the current state of the
   * ListView and its children.
   */
  update() {
    const unseen = new Set(this.itemToInfo.keys());
    // The DOM element that's at the current position where we want to place the
    // item that we're processing in this loop iteration.  This becomes null
    // when we're at the end of the list.
    let curDomElem = this.firstElementChild;
    for (const item of this.listView.items) {
      unseen.delete(item);
      let info = this.itemToInfo.get(item);
      if (!info) {
        // The item is new to being rendered; create it and insert it before the
        // currrent existing element.
        const elem = new this.elementConstructor(item);
        info = {
          elem,
          serial: item.serial,
        };
        this.itemToInfo.set(item, info);
        this.insertBefore(elem, curDomElem);
        elem.update();
        // Our newly inserted element is now the current element; we'll still
        // want to advance at the bottom of the loop.
        curDomElem = elem;
      } else {
        // (We've previously rendered the item.)

        // Re-render the item if its state has changed.
        if (info.serial < item.serial) {
          item.elem.update();
        }
        // If the element isn't already our current element, then move it here.
        if (curDomElem !== info.elem) {
          this.insertBefore(item.elem, curDomElem);
          curDomElem = item.elem;
        }
      }

      curDomElem = curDomElem.nextElementSibling;
    }

    // At this point curDomElem, if non-null, should be the first of any
    // elements to remove.
    //
    // However, we just process the unseen list in order to clean up the
    // itemToInfo map which directly provides us with the elements.
    for (const removedItem of unseen) {
      const removedInfo = this.itemToInfo.get(removedItem);
      this.itemToInfo.delete(removedItem);

      removedInfo.elem.remove();
    }
  }
}
customElements.define("awi-list-view", ListView);
