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

/**
 * Filter ical events which are happening "now" or today.
 */
export default function EventFilter(params, args) {
  this.durationBeforeInMillis =
    (args.durationBeforeInMinutes ?? -1) * 60 * 1000;
  this.type = args.type;
}
EventFilter.prototype = {
  /**
   * We don't need anything beyond the message.
   */
  gather: {},

  /**
   * Orders of magnitude: boolean (1), string (10), honking big string (100).
   */
  cost: 10,

  /**
   * Depending on incoming/outgoing folder type, the author may be important for
   * UI purposes.  We perhaps could/should parameterize this.
   */
  alwaysRun: true,

  test(gathered) {
    if (this.durationBeforeInMillis < 0) {
      return true;
    }
    const message = gathered?.message;
    if (!message || !("startDate" in message)) {
      return true;
    }

    const { startDate, endDate } = message;
    const now = new Date().valueOf();
    const dayInMillis = 24 * 60 * 60 * 1000;

    if (startDate > now + dayInMillis) {
      // Event is in more than 24h.
      return false;
    }

    if (endDate <= now) {
      // Event is finished.
      return false;
    }

    if (this.type === "now") {
      const shiftedStartDate = startDate - this.durationBeforeInMillis;
      if (now < shiftedStartDate) {
        // The event will appear in (shiftedStartDate - now) ms.
        return {
          durationBeforeToBeValid: shiftedStartDate - now,
        };
      }

      // The event will disappear in (endDate - now) ms.
      return {
        durationBeforeToBeInvalid: endDate - now,
      };
    }

    // Keep events which are happening today.
    const tomorrow = dayInMillis * Math.floor(1 + now / dayInMillis);
    if (startDate >= tomorrow) {
      return false;
    }

    return {
      durationBeforeToBeInvalid: endDate - now,
    };
  },
};
