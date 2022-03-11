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

import { NOW } from "shared/date";

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
      return false;
    }

    if (message.recurrenceRules) {
      // It's the main event describing a recurring event so it doesn't have
      // to be in the view.
      return false;
    }

    const { startDate, endDate, isAllDay } = message;
    const nowTS = NOW();

    if (this.type === "now") {
      if (isAllDay || endDate <= nowTS) {
        // Event is finished.
        return false;
      }

      const shiftedStartDate = startDate - this.durationBeforeInMillis;
      if (nowTS < shiftedStartDate) {
        // The event will appear in (shiftedStartDate - now) ms.
        return {
          durationBeforeToBeValid: shiftedStartDate - nowTS,
        };
      }

      // The event will disappear in (endDate - now) ms.
      return {
        durationBeforeToBeInvalid: endDate - nowTS,
      };
    }

    // this.type === "browse".

    const todayTS = new Date(nowTS).setHours(0, 0, 0, 0);
    const _date = new Date(todayTS);
    const tomorrowTS = _date.setDate(_date.getDate() + 1);

    if (endDate <= todayTS) {
      // Event finished before today.
      return false;
    }

    if (startDate >= tomorrowTS) {
      // Event begins after tomorrow.
      const _startDateTS = new Date(startDate).setHours(0, 0, 0, 0);
      return {
        durationBeforeToBeValid: _startDateTS - nowTS,
      };
    }

    // Get the "tomorrow" after endDate
    let _endDate = new Date(endDate);
    _endDate.setHours(0, 0, 0, 0);
    const _endDateTS = _endDate.setDate(_endDate.getDate() + 1);

    return {
      durationBeforeToBeInvalid: _endDateTS - nowTS,
    };
  },
};
