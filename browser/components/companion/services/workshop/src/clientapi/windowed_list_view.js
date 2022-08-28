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

import { Emitter } from "evt";

/**
 * @typedef {Object} SeekChangeInfo
 * @property {Boolean} offset
 *   Did the offset change?  If so, you might need to do a coordinate-space
 *   fixup in your virtual list at some point.
 * @property {Boolean} totalCount
 *   Did the total number of items in the true list change?  If so, you might
 *   need to adjust the scroll height of your container.
 * @property {Boolean} itemSet
 *   Were items added/removed/reordered from the items list?  If false, then
 *   for all x, `preItems[x] === postItems[x]`.  Items that were not yet loaded
 *   from the database and therefore null count as a change now that they
 *   properly get an object instance.
 * @property {Boolean} itemContents
 *   Did the contents of some of the items change?  If you care about checking
 *   whether an item's contents changed, you can compare its `serial` with the
 *   WindowedListView's `serial`.  If the values are the same then the item was
 *   updated (or new) in this seek.  If this is inefficient for you, we can add
 *   a list of changed indices or whatever works for you.  Let's discuss.
 */

/**
 * A windowed (subset) view into a conceptually much larger list view.
 *
 * ## Events ##
 * - `seeked` (SeekChangeInfo): Fired when anything happens.  ANYTHING.  This is
 *   the only event you get and you'll like it.  Because the koolaid is
 *   delicious.
 *
 */

export class WindowedListView extends Emitter {
  #bufferedState;

  constructor(api, itemConstructor, handle) {
    super();
    this._api = api;
    this.handle = handle;
    this._itemConstructor = itemConstructor;
    this.released = false;

    this.serial = 0;
    this.tocMetaSerial = 0;

    /**
     * The index of `items[0]` in the true entire list.  If this is zero, then we
     * are at the top of the list.
     */
    this.offset = 0;
    this.heightOffset = 0;
    this.totalCount = 0;
    this.totalHeight = 0;
    /**
     * @type {Array<ItemInstance|null>}
     *
     * The list of items
     */
    this.items = [];
    /**
     * @type {Map<Id, ItemInstance>}
     *
     * Maps id's to non-null object instances.  If we don't have the data yet,
     * then there is no entry in the map.  (This is somewhat arbitrary for
     * control-flow purposes below; feel free to change if you update the control
     * flow.)
     */
    this._itemsById = new Map();

    this.tocMeta = {};

    /**
     * Has this slice been completely initially populated?  If you want to wait
     * for this, use once('complete').
     */
    this.complete = false;

    this.viewKind = "windowed";

    this.useCoherentMode = true;
    this.#bufferedState = null;
  }

  toString() {
    return (
      "[WindowedListView: " +
      this._itemConstructor.name +
      " " +
      this.handle +
      "]"
    );
  }

  toJSON() {
    return {
      type: "WindowedListView",
      namespace: this._ns,
      handle: this.handle,
    };
  }

  /**
   * Coherent mode helper to merge newly received update details with already
   * received #bufferedState.  See `__update` for more context.
   */
  #mergeBufferedState(details) {
    if (!this.#bufferedState) {
      this.#bufferedState = details;
      return;
    }

    // We can propagate the simple scalar fields.
    this.#bufferedState.offset = details.offset;
    this.#bufferedState.heightOffset = details.heightOffset;
    this.#bufferedState.totalCount = details.totalCount;
    this.#bufferedState.totalHeight = details.totalHeight;
    this.#bufferedState.tocMeta = details.tocMeta;

    // `ids` is the current list of identifiers.  Each update is authoritative,
    // so we can overwrite, but we also need to make sure that we remove any
    // `values` which are no longer present in `ids`
    this.#bufferedState.ids = details.ids;
    for (const id of this.#bufferedState.values.keys()) {
      if (!details.ids.includes(id)) {
        this.#bufferedState.values.delete(id);
      }
    }
    for (const [id, value] of details.values.entries()) {
      this.#bufferedState.values.set(id, value);
    }

    // (events can be null)
    if (details.events) {
      if (this.#bufferedState.events) {
        this.#bufferedState.events.push(...details.events);
      } else {
        this.#bufferedState.events = details.events;
      }
    }
  }

  /**
   * Receive and process updates.
   *
   * ### Incremental updates versus Coherent Snapshot updates.
   *
   * Originally all updates would be applied whenever they were received, which
   * we'll call incremental mode.  This made a lot of sense for a mail UI where
   * messages/conversations were largely immutable and obeyed time's arrow.
   * This is less suitable for calendars, and so we want the ability to only
   * update at specific "coherent snapshots".
   *
   * When operating in incremental mode, we apply changes as they're received.
   * When operating in snapshot mode, we accumulate changes until we receive an
   * update that's a `coherentSnapshot`, in which case we then we still update
   * our aggregate state and then we apply that aggregated state.
   */
  __update(details) {
    if (this.useCoherentMode) {
      // If we already have any buffered state or this isn't a coherent snapshot
      // then we need to integrate the state into the buffered state.
      if (this.#bufferedState || !details.coherentSnapshot) {
        this.#mergeBufferedState(details);
      }
      if (!details.coherentSnapshot) {
        return;
      }
      // Use and consume the buffered state if we have one.
      if (this.#bufferedState) {
        details = this.#bufferedState;
        this.#bufferedState = null;
      }
    }

    let newSerial = ++this.serial;

    let existingSet = this._itemsById;
    let newSet = new Map();

    let newIds = details.ids;
    let newStates = details.values;
    let newItems = [];

    // Detect a reduction in set size by a change in length; all other changes
    // will be caught by noticing new objects.
    let itemSetChanged = newIds.length !== this.items.length;
    let contentsChanged = false;

    // - Process our contents
    for (const id of newIds) {
      let obj;
      // Object already known, update.
      if (existingSet.has(id)) {
        obj = existingSet.get(id);
        // Update the object if we have new state
        if (newStates.has(id)) {
          let [newState, newOverlays] = newStates.get(id);
          contentsChanged = true;
          obj.serial = newSerial;
          if (newState) {
            obj.__update(newState);
          }
          if (newOverlays) {
            obj.__updateOverlays(newOverlays);
          }
          obj.emit("change", !!newState, !!newOverlays);
        }
        // Remove it from the existingSet so we can infer objects no longer in
        // the set.
        existingSet.delete(id);
        newSet.set(id, obj);
      } else if (newStates.has(id)) {
        itemSetChanged = true;
        let [newState, newOverlays, matchInfo] = newStates.get(id);
        obj = new this._itemConstructor(
          this._api,
          newState,
          newOverlays,
          matchInfo,
          this
        );
        obj.serial = newSerial;
        newSet.set(id, obj);
      } else {
        // No state available yet, push null as a placeholder.
        obj = null;
      }
      newItems.push(obj);
    }

    // - If anything remained, kill it off
    for (const deadObj of existingSet.values()) {
      itemSetChanged = true;
      deadObj.release();
    }

    const whatChanged = {
      offset: details.offset !== this.offset,
      totalCount: details.totalCount !== this.totalCount,
      itemSet: itemSetChanged,
      itemContents: contentsChanged,
    };
    this.offset = details.offset;
    this.heightOffset = details.heightOffset;
    this.totalCount = details.totalCount;
    this.totalHeight = details.totalHeight;
    this.items = newItems;
    this._itemsById = newSet;

    if (details.tocMeta) {
      this.tocMeta = details.tocMeta;
      this.tocMetaSerial++;
      this.emit("metaChange", this.tocMeta);
    }

    this.emit("seeked", whatChanged);

    if (details.events) {
      for (const { name, data } of details.events) {
        this.emit(name, data);
      }
    }
  }

  // TODO: determine whether these are useful at all; seems like the virtual
  // scroll widget needs to inherently know these things and these are useless.
  // These come from a pre-absolutely-positioned implementation.
  get atTop() {
    return this.offset === 0;
  }
  get atBottom() {
    return this.totalCount === this.offset + this.items.length;
  }

  /**
   * Return the item by absolute index, returning null if it's outside the
   * currently seeked range.
   *
   * This method does not infer seeks that should happen as a byproduct of gets
   * outside the seeked range.  Your code needs to issue the seek calls itself
   * based on an understanding of the visible item range and the buffering you
   * want.
   */
  getItemByAbsoluteIndex(absIndex) {
    let relIndex = absIndex - this.offset;
    if (relIndex < 0 || relIndex >= this.items.length) {
      return null;
    }
    return this.items[relIndex];
  }

  /**
   * Seek to the top of the list and latch there so that our slice will always
   * include the first `numDesired` items in the list.
   */
  seekToTop(visibleDesired, bufferDesired) {
    this._api.__bridgeSend({
      type: "seekProxy",
      handle: this.handle,
      mode: "top",
      visibleDesired,
      bufferDesired,
    });
  }

  /**
   * Seek with the intent that we are anchored to a specific item as long as it
   * exists.  If the item ceases to exist, we will automatically re-anchor to
   * one of the adjacent items at the time of its removal.
   *
   * @param {Object} item
   *   The item to focus on.  This must be a current item in `items` or
   *   we will throw.
   */
  seekFocusedOnItem(
    item,
    bufferAbove,
    visibleAbove,
    visibleBelow,
    bufferBelow
  ) {
    let idx = this.items.indexOf(item);
    if (idx === -1) {
      throw new Error("item is not in list");
    }
    this._api.__bridgeSend({
      type: "seekProxy",
      handle: this.handle,
      mode: "focus",
      focusKey: this._makeOrderingKeyFromItem(item),
      bufferAbove,
      visibleAbove,
      visibleBelow,
      bufferBelow,
    });
  }

  /**
   * Seek to an arbitrary absolute index in the list and then anchor on whatever
   * item is at that location.  For UI purposes it makes the most sense to have
   * the index correspond to the first visible message in your list or the
   * central one.
   */
  seekFocusedOnAbsoluteIndex(
    index,
    bufferAbove,
    visibleAbove,
    visibleBelow,
    bufferBelow
  ) {
    this._api.__bridgeSend({
      type: "seekProxy",
      handle: this.handle,
      mode: "focusIndex",
      index,
      bufferAbove,
      visibleAbove,
      visibleBelow,
      bufferBelow,
    });
  }

  /**
   * Seek to the bottom of the list and latch there so that our slice will
   * always include the last `numDesired` items in the list.
   */
  seekToBottom(visibleDesired, bufferDesired) {
    this._api.__bridgeSend({
      type: "seekProxy",
      handle: this.handle,
      mode: "bottom",
      visibleDesired,
      bufferDesired,
    });
  }

  /**
   * Given a quantized-height-supporting back-end where every item has an
   * integer height associated with it that creates an arbitrary coordinate
   * space, seek using that coordinate space, latching on the first visible
   * item.
   *
   * IMPORTANT NOTE!  Latching on the item is usually not what you want if you
   * are at the top of the list and you want to see new items as they come in.
   * AKA, if you are seeking to offset 0, you probably want to use `seekToTop`.
   * I'm a bit conflicted about whether we should just be baking this mode of
   * operation into this or support flags/etc. to help you do this.  But for
   * now it's on you.
   *
   * This mode of seeking assumes a virtual list widget with some concept of
   * the visible region and a buffer before it and after it.
   */
  seekInCoordinateSpace(offset, before, visible, after) {
    this._api.__bridgeSend({
      type: "seekProxy",
      handle: this.handle,
      mode: "coordinates",
      offset,
      before,
      visible,
      after,
    });
  }

  release() {
    if (this.released) {
      return;
    }
    this.released = true;

    this._api.__bridgeSend({
      type: "cleanupContext",
      handle: this.handle,
    });

    for (const item of this.items) {
      if (item) {
        item.release();
      }
    }
  }
}
