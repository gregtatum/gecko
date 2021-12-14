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
 * The builtin setTimeout support only delay lower than 2**31 - 1.
 * This max corresponds to ~25 days and very likely Firefox
 * will be killed before this max.
 * But when a higher number is passed then it's considered as 0 which
 * is not what one could expect.
 * So the usual function is extended in order to support a delay lower than
 * Number.MAX_SAFE_INTEGER (which corresponds to ~2856 centuries!).
 *
 * @param {function} callback - function to call after the delay
 * @param {number} delay - a duration in ms
 * @returns
 */
export function setExtendedTimeout(callback, delay) {
  if (delay > Number.MAX_SAFE_INTEGER) {
    throw new Error("Delay is a way too large.");
  }

  const result = { id: -1 };
  const MAX = 2 ** 31 - 1;
  if (delay <= MAX) {
    result.id = setTimeout(callback, delay);
    return result;
  }

  const gen = (function*(maxDelay) {
    let sum = 0;
    while (sum + MAX < maxDelay) {
      sum += MAX;
      yield MAX;
    }
    return maxDelay - sum;
  })(delay);

  const nextIteration = () => {
    const value = gen.next();
    result.id = setTimeout(value.done ? callback : nextIteration, value.value);
  };

  result.id = setTimeout(nextIteration, gen.next().value);
  return result;
}
