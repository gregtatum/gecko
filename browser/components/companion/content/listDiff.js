/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Given two lists, produces an edit script which will transform the first list
 * into the second.
 *
 * @param {Array | Object} oldList
 *   The initial list, prior to modifications.
 * @param {Array | Object} newList
 *   The new list, for which we want to produce an edit script from oldList.
 * @param {Function} getKeyOld [optional]
 *   A function which, given an entry in the old list, produces a unique key to
 *   identify that entry.
 * @param {Function} getKeyNew [optional]
 *   A function which, given an entry in the new list, produces a unique key to
 *   identify that entry.
 * @returns {Array}
 *   An array of edit script entries, which transform oldList into newList.
 *   Each entry will have a `type` field, which will be either "insertion",
 *   "move", or "deletion". Items which remain in place will be labeled as
 *   "move". Each "move" and "deletion" will also have an `oldIndex` field
 *   which holds the index of the item within oldList.
 */
export function getListDiff(
  oldList,
  newList,
  getKeyOld = a => a,
  getKeyNew = a => a
) {
  if (!("length" in oldList)) {
    throw new Error(
      "First argument to getListDiff must be an Array or Array-like object."
    );
  }
  if (!("length" in newList)) {
    throw new Error(
      "Second argument to getListDiff must be an Array or Array-like object."
    );
  }

  let oldMap = getIndicesMap(oldList, getKeyOld);
  let newMap = getIndicesMap(newList, getKeyNew);

  let results = [];
  let priorInsertions = [0];
  let numInsertions = 0;
  for (let i = 0; i < newList.length; i++) {
    let val = newList[i];
    let key = getKeyNew(val);
    let oldIndex = oldMap.get(key);
    if (oldIndex === undefined) {
      results.push({
        type: "insertion",
        data: val,
      });
      priorInsertions.push(numInsertions);
      numInsertions++;
    } else {
      results.push({
        type: "move",
        data: val,
        oldIndex,
      });
      priorInsertions.push(numInsertions);
    }
  }

  for (let i = 0; i < oldList.length; i++) {
    let val = oldList[i];
    let key = getKeyOld(val);
    if (!newMap.has(key)) {
      // We try here to compute where an item from the old list *would* be in
      // the new list, were it not deleted. There can be no right solution to
      // this problem, as the element simply isn't there anymore. We could
      // simply leave the delete at the index it was in the initial list.
      // However, this leaves us with the following edit script production
      //     [A, B, C, D, E] -> [Z, A, B, C, E]
      //     == [insert Z, move A, move B, delete D, move C, move E]
      // Which is a problem, because now the deletion of D comes between B and
      // C, instead of between C and E where it was. The solution to this
      // problem that we rely on is to simply count the insertions before the
      // location where the deleted element was, and add those to the deletion
      // index. This isn't perfect, but it's simple, and any solution we
      // propose here is going to have some intuitive property that it
      // violates.
      let insertions = priorInsertions[Math.min(priorInsertions.length - 1, i)];
      results.splice(i + insertions, 0, {
        type: "deletion",
        data: val,
        oldIndex: i,
      });
    }
  }

  return results;
}

function getIndicesMap(list, getKey) {
  let result = new Map();
  for (let i = 0; i < list.length; i++) {
    result.set(getKey(list[i]), i);
  }
  return result;
}
