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
import logic from "logic";
import { RefedResource } from "../refed_resource";

/**
 * Base class for TOC implementations.
 *
 * Brought into existence with the introduction of metaHelpers since it marked
 * a turning point in the trade-offs between "code duplication in the name of
 * clarity" and "oh crap, code duplication, this is not going to end well!".
 * (Most of the code was also subtly different for each TOC up to this point.)
 */
export class BaseTOC extends Emitter {
  constructor({ metaHelpers = [], refreshHelpers = [], onForgotten }) {
    super();
    RefedResource.call(this, onForgotten);

    this._metaHelpers = metaHelpers;
    this._refreshHelpers = refreshHelpers;

    this.tocMeta = {};
    this._everActivated = false;

    /**
     * Optional hook to let lazy/pull-based TOC's
     */
    this.flush = null;
  }

  // TODO more rigorous mixin magic
  static checkProtoValidity(obj) {
    Object.keys(BaseTOC.prototype).forEach(function(prop) {
      // allow optional methods like "flush" which we only define as null.
      // eslint-disable-next-line no-prototype-builtins
      if (!obj.hasOwnProperty(prop)) {
        obj[prop] = BaseTOC.prototype[prop];
      } else if (BaseTOC.prototype[prop]) {
        throw new Error("object and base both have truthy property: " + prop);
      }
    });
    return obj;
  }

  __activate() {
    this._everActivated = true;
    for (const metaHelper of this._metaHelpers) {
      logic(this, "activatingMetaHelper", {
        name: metaHelper.constructor && metaHelper.constructor.name,
      });
      metaHelper.activate(this);
    }

    return this.__activateTOC.apply(this, arguments);
  }

  __deactivate() {
    if (this._everActivated) {
      for (const metaHelper of this._metaHelpers) {
        metaHelper.deactivate(this);
      }
    }

    return this.__deactivateTOC.apply(this, arguments);
  }

  /**
   * A helper that takes a dictionary and applies it to `tocMeta`.  Exists as
   * a central logging point and to have a quick/easy way to do simple diffing
   * to know whether anything is actually changing to avoid emitting events if
   * nothing is changing.  Although there is some performance motivation to
   * this, I expect this to be a larger debugging win because there won't be
   * misleading messages transiting the system that have no effect.
   */
  applyTOCMetaChanges(changes) {
    const tocMeta = this.tocMeta;
    let somethingChanged = false;
    for (const key of Object.keys(changes)) {
      const value = changes[key];
      if (tocMeta[key] !== value) {
        tocMeta[key] = value;
        somethingChanged = true;
      }
    }

    if (somethingChanged) {
      this.emit("tocMetaChange", tocMeta);
    }
  }

  /**
   * Emit an event.  The list view proxy should be listening for this,
   * accumulate the event, dirty the proxy, and then send the event as part of
   * its flush.  On the client side this should then be emitted on the list view
   * instance with the provided eventName and eventData.
   */
  broadcastEvent(eventName, eventData) {
    this.emit("broadcastEvent", eventName, eventData);
  }

  /**
   * Trigger a refresh on this TOC, returning a Promise that will be resolved
   * when all constituent refreshes have completed or rejected if any refreshes
   * reject.  (Promise.all semantics for now unless we need to change it.)
   */
  refresh(why) {
    const refreshPromises = this._refreshHelpers.map(x => x(why));
    return Promise.all(refreshPromises);
  }
}

RefedResource.mix(BaseTOC.prototype);
