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

export function prepareChangeForProblems(account, problem) {
  if (!problem) {
    return new Map([[account.id, { problems: null }]]);
  }

  // Merge account problems with the new incoming problem.
  const newProblems = account.problems
    ? Object.assign({}, account.problems)
    : Object.create(null);
  for (const [key, value] of Object.entries(problem)) {
    if (!newProblems[key]) {
      newProblems[key] = [];
    }
    if (!newProblems[key].includes(value)) {
      newProblems[key].push(value);
    }
  }

  return new Map([[account.id, { problems: newProblems }]]);
}

/**
 * @param {Array|Map} obj - An array or a Map.
 * @returns the same array or an array from the values.
 */
export function toArray(obj) {
  return Array.isArray(obj) ? obj : [...obj.values()];
}
