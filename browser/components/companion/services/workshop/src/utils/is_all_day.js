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

const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Helper function that takes an event start and end date and outputs
 * whether or not it spans one day or more.
 *
 * @param {String}  startDate
 *        The start date of the event. Represented in ISO format.
 * @param {String}  endDate
 *        The end date of the event. Represented in ISO format.
 * @param {Number}  upperBound
 *        Defaults to 12 hours. Specifies a limit on how many hours an
 *        event spans until it's considered an all day event.
 */
export function isAllDayEvent(startDate, endDate, upperBound = 12) {
  startDate = new Date(startDate);
  endDate = new Date(endDate);

  let durationInMs = endDate.getTime() - startDate.getTime();
  let durationInHours = durationInMs / ONE_HOUR_MS;

  return durationInHours >= upperBound;
}
