/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Accumulates logic messages sent from the front-end workshopAPI and back-end
 * over BroadcastChannel (using the identifier "logic").
 */
export class BroadcastCollector {
  constructor() {
    this.entries = [];
    this.honorClears = false;
    this.generation = 1;
    this.serial = 1;
    this.listener = null;
    this.pendingTimeout = null;

    this.bc = new BroadcastChannel("logic");
    this.bc.onmessage = evt => {
      if (evt.data.mode === "clear") {
        this.clear();
        return;
      }
      if (evt.data.mode !== "append") {
        return;
      }
      this.serial++;

      const logicEvent = evt.data.event;
      // For now the BroadcastChannel wrapper payload includes a "tid" that was
      // also clobbered onto the logic object like the `bc`.  If/when the data
      // moves to being buffered in the worker itself, this could be assigned
      // based on assigning a unique id to the MessagePort via WeakMap / via the
      // mailbridge.
      logicEvent.tid = evt.data.tid;
      logicEvent.guid = `${evt.data.tid}:${logicEvent.id}`;
      this.entries.push(logicEvent);

      if (this.pendingTimeout) {
        return;
      }

      this.scheduleTimer();
    };
  }

  attachListener(listener, fire = false) {
    this.listener = listener;
    if (fire) {
      Promise.resolve().then(() => {
        this.onTimerFired();
      });
    }
  }

  detachListener(listener) {
    if (this.listener === listener) {
      this.listener = null;
    }
  }

  scheduleTimer() {
    if (this.pendingTimeout || !this.listener) {
      return;
    }

    this.pendingTimeout = setTimeout(() => {
      this.pendingTimeout = null;
      this.onTimerFired();
    }, 10);
  }

  onTimerFired() {
    if (this.listener) {
      this.listener.logsUpdated();
    }
  }

  clear() {
    if (this.honorClears) {
      this.generation++;
      this.serial++;
      this.entries = [];

      this.scheduleTimer();
    }
  }
}
