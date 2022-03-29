/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Accumulates logic messages sent from the front-end workshopAPI and back-end
 * over BroadcastChannel (using the identifier "logic").
 */
export class LogsCollector {
  constructor() {
    this.entries = null;
    this.honorClears = false;
    this.generation = 1;
    this.serial = 1;
    this.listener = null;
    this.pendingTimeout = null;
    this.workshopAPI = null;
    this.forceRefresh = false;
    this.areLocalData = false;
  }

  loadData(data) {
    this.entries = data;
    this.areLocalData = true;
  }

  async setWorkshop(workshopAPI) {
    if (this.areLocalData) {
      // We are displaying entries from a file so, there are no need to set
      // a workshop instance.
      return;
    }

    this.workshopAPI = workshopAPI;
    try {
      this.entries = await this.workshopAPI.getLogicBuffer();
      this.forceRefresh = true;
    } catch {}
  }

  attachListener(listener) {
    this.listener = listener;

    if (!this.areLocalData) {
      this.scheduleTimer();
    }
  }

  detachListener(listener) {
    if (this.listener === listener) {
      this.areLocalData = false;
      this.listener = null;
      this.entries = null;
      if (this.pendingTimeout) {
        clearTimeout(this.pendingTimeout);
        this.pendingTimeout = null;
      }
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

  async onTimerFired() {
    if (this.forceRefresh && this.listener) {
      this.forceRefresh = false;
      this.listener.logsUpdated();
    }

    if (!this.workshopAPI) {
      this.scheduleTimer();
      return;
    }

    let entries;
    try {
      entries = await this.workshopAPI.getLastLogicEntries();
    } catch (e) {
      console.error("Something went wrong in getting logs entries.", e);
    }

    if (!entries?.length) {
      this.scheduleTimer();
      return;
    }

    this.entries.push(...entries);

    if (this.listener) {
      this.listener.logsUpdated();
    }

    this.scheduleTimer();
  }
}
