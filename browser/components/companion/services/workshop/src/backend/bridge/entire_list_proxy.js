/**
 * Copyright 2021 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import logic from "logic";

/**
 * Backs an `EntireListView`, see its docs for more context.
 *
 * @param {TOC} toc
 *   An unowned reference to the TOC.  It is expected/required that our caller
 *   has acquired a reference for it and will __release it at the same time
 *   they __release us.
 * @param {NamedContext} ctx
 */
export default function EntireListProxy(toc, ctx) {
  logic.defineScope(this, "EntireListProxy", { tocType: toc.type });

  this.toc = toc;
  this.ctx = ctx;
  this.batchManager = ctx.batchManager;
  this.overlayResolver = ctx.dataOverlayManager.makeBoundResolver(
    toc.overlayNamespace,
    ctx
  );

  this._bound_onAdd = this.onAdd.bind(this);
  this._bound_onChange = this.onChange.bind(this);
  this._bound_onOverlayPush = this.onOverlayPush.bind(this);
  this._bound_onRemove = this.onRemove.bind(this);

  this._pendingChanges = [];
  this._idToChangeIndex = new Map();
  // initialize to dirty so that populateFromList can be in charge
  this.dirty = true;
  // see WindowedListProxy and BatchManager's documentation on this field.
  this.needsCoherentFlush = true;
  this._active = false;
}
EntireListProxy.prototype = {
  /**
   * Trigger initial population.  This should be called exactly once at
   * initialization.  This is required to be explicitly called to make things
   * slightly less magic and give the caller some additional control.
   */
  populateFromList() {
    let items = this.toc.getAllItems();
    for (let i = 0; i < items.length; i++) {
      this.onAdd(items[i], i);
    }

    this.batchManager.registerDirtyView(this, "immediate");

    this.toc.on("add", this._bound_onAdd);
    this.toc.on("change", this._bound_onChange);
    this.toc.on("remove", this._bound_onRemove);

    this.ctx.dataOverlayManager.on(
      this.toc.overlayNamespace,
      this._bound_onOverlayPush
    );
  },

  /**
   * Dummy acquire implementation; we only allow a single owner.  We could make
   * this call populateFromList, but for now we don't for clarity.
   */
  __acquire() {
    return Promise.resolve(this);
  },

  __release() {
    if (!this._active) {
      return;
    }
    this._active = false;

    this.toc.removeListener("add", this._bound_onAdd);
    this.toc.removeListener("change", this._bound_onChange);
    this.toc.removeListener("remove", this._bound_onRemove);

    this.ctx.dataOverlayManager.removeListener(
      this.toc.overlayNamespace,
      this._bound_onOverlayPush
    );
  },

  _dirty() {
    if (this.dirty) {
      return;
    }

    this.dirty = true;
    this.needsCoherentFlush = true;
    this.batchManager.registerDirtyView(this);
  },

  onAdd(item, index) {
    this._dirty();

    this._idToChangeIndex.set(item.id, this._pendingChanges.length);
    this._pendingChanges.push({
      type: "add",
      index,
      state: item,
      // since we're adding the item, we need to pull the overlay data.
      overlays: this.overlayResolver(item.id),
    });
  },

  onChange(item, index) {
    // Update the existing add/change to have the updated state rather than
    // adding a change that clobbers the previous state
    if (this._idToChangeIndex.has(item.id)) {
      // (we're already dirty)
      let changeIndex = this._idToChangeIndex.get(item.id);
      this._pendingChanges[changeIndex].state = item;
      return;
    }

    this._dirty();
    this._idToChangeIndex.set(item.id, this._pendingChanges.length);
    this._pendingChanges.push({
      type: "change",
      index,
      state: item,
      // we don't need to pull the overlay data because it will not have changed
      // unless we get a push.
      overlays: null,
    });
  },

  onOverlayPush(itemId) {
    // If the TOC does't know about the item, then there's nothing to report.
    if (!this.toc.itemsById.has(itemId)) {
      return;
    }

    // We must be interested, demand that the overlay be computed.
    // TODO: potential improvement: consider having the event also pass in a
    // lazy/memoizing func.
    let overlays = this.overlayResolver(itemId);

    // If we had a pending data change or overlays change already, reuse.
    if (this._idToChangeIndex.has(itemId)) {
      // (we're already dirty)
      let changeIndex = this._idToChangeIndex.get(itemId);
      this._pendingChanges[changeIndex].overlays = overlays;
      return;
    }

    this._dirty();
    this._idToChangeIndex.set(itemId, this._pendingChanges.length);
    this._pendingChanges.push({
      type: "change",
      // This is absolutely essential; it's not freebie meta-data, it's how the
      // EntireListView currently retrieves the object from its list.
      index: this.toc.getItemIndexById(itemId),
      state: null,
      overlays,
    });
  },

  onRemove(id, index) {
    this._dirty();

    this._pendingChanges.push({
      type: "remove",
      index,
    });
    this._idToChangeIndex.delete(id);
  },

  flush() {
    let changes = this._pendingChanges;
    this._pendingChanges = [];
    this._idToChangeIndex.clear();
    this.dirty = false;

    return {
      changes,
      // Because we never do database lookups, this can always be considered a
      // coherent snapshot for this method's purposes, although the BatchManager
      // may switch this to false depending on why we're being flushed.
      coherentSnapshot: true,
    };
  },
};
