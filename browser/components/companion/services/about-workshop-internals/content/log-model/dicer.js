/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export const WORKSHOP_DICER_CONFIG = {
  foo: 1,
};

export class HierarchyDicer {
  constructor({ collector, config, listener }) {
    this.config = config;
    this.listener = listener;

    this.processedGeneration = 0;
    this.processedSerial = 0;
    this.processedIndex = 0;
    if (collector) {
      this.attachToCollector(collector);
    }
  }

  attachToCollector(collector) {
    if (this.collector) {
      this.collector.listener = null;
    }
    this.collector = collector;
    collector.listener = this;

    this.logsUpdated();
  }
}
