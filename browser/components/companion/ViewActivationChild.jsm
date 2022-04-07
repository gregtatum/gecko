/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["ViewActivationChild"];

ChromeUtils.defineModuleGetter(
  this,
  "DeferredTask",
  "resource://gre/modules/DeferredTask.jsm"
);

// For performance reasons, we coalesce bursts of wheel and key events
// so that they don't result in activations more than 1 time per
// DEFERRED_TASK_DELAY_MS milliseconds.
const DEFERRED_TASK_DELAY_MS = 100;

class ViewActivationChild extends JSWindowActorChild {
  #deferredEventTask = null;

  constructor() {
    super();
    this.#deferredEventTask = new DeferredTask(
      () => this.requestActivation(),
      DEFERRED_TASK_DELAY_MS
    );
  }

  destructor() {
    this.#deferredEventTask.disarm();
  }

  handleEvent(event) {
    if (!event.isTrusted) {
      return;
    }

    // Clicks result in an immediate activation, since they don't
    // tend to come in clusters.
    if (event.type == "click") {
      this.requestActivation();
      return;
    }

    // For other events that might come in clusters, we're going to use
    // DeferredTask to throttle.

    // At this point, we either have a wheel event or a keydown
    // event. For keydown events, we don't actually know if this
    // is a keyevent that we consider a user interaction (as opposed)
    // to a key like the Function keys, which we don't want to consider
    // as a user-interaction key event. So we ask nsIDOMWindowUtils
    // to help us determine whether or not this is a key event that
    // we care about.
    let isUserActivity = false;
    if (event.type == "wheel") {
      isUserActivity = true;
    } else if (event instanceof KeyboardEvent) {
      let winUtils = this.contentWindow.windowUtils;
      isUserActivity = winUtils.isKeyboardEventUserActivity(event);
    }

    if (isUserActivity && !event.defaultPrevented) {
      this.#deferredEventTask.arm();
    }
  }

  requestActivation() {
    this.sendAsyncMessage("RequestActivation", {});
  }
}
