/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_insertInitialItem() {
  const { getListDiff } = await import(
    "chrome://browser/content/companion/listDiff.js"
  );
  const oldList = [];
  const newList = ["A"];
  const expected = [{ type: "insertion", data: "A" }];
  const actual = getListDiff(oldList, newList);
  Assert.deepEqual(actual, expected);
});

add_task(async function test_insertItemInMiddle() {
  const { getListDiff } = await import(
    "chrome://browser/content/companion/listDiff.js"
  );
  const oldList = ["A", "B"];
  const newList = ["A", "C", "B"];
  const expected = [
    { type: "move", data: "A", oldIndex: 0 },
    { type: "insertion", data: "C" },
    { type: "move", data: "B", oldIndex: 1 },
  ];
  const actual = getListDiff(oldList, newList);
  Assert.deepEqual(actual, expected);
});

add_task(async function test_insertItemAtEnd() {
  const { getListDiff } = await import(
    "chrome://browser/content/companion/listDiff.js"
  );
  const oldList = ["A", "B"];
  const newList = ["A", "B", "C"];
  const expected = [
    { type: "move", data: "A", oldIndex: 0 },
    { type: "move", data: "B", oldIndex: 1 },
    { type: "insertion", data: "C" },
  ];
  const actual = getListDiff(oldList, newList);
  Assert.deepEqual(actual, expected);
});

add_task(async function test_deleteOneItem() {
  const { getListDiff } = await import(
    "chrome://browser/content/companion/listDiff.js"
  );
  const oldList = ["A"];
  const newList = [];
  const expected = [{ type: "deletion", data: "A", oldIndex: 0 }];
  const actual = getListDiff(oldList, newList);
  Assert.deepEqual(actual, expected);
});

add_task(async function test_deleteThreeItems() {
  const { getListDiff } = await import(
    "chrome://browser/content/companion/listDiff.js"
  );
  const oldList = ["A", "B", "C"];
  const newList = [];
  const expected = [
    { type: "deletion", data: "A", oldIndex: 0 },
    { type: "deletion", data: "B", oldIndex: 1 },
    { type: "deletion", data: "C", oldIndex: 2 },
  ];
  const actual = getListDiff(oldList, newList);
  Assert.deepEqual(actual, expected);
});

add_task(async function test_deleteItemFromBeginning() {
  const { getListDiff } = await import(
    "chrome://browser/content/companion/listDiff.js"
  );
  const oldList = ["A", "B", "C"];
  const newList = ["B", "C"];
  const expected = [
    { type: "deletion", data: "A", oldIndex: 0 },
    { type: "move", data: "B", oldIndex: 1 },
    { type: "move", data: "C", oldIndex: 2 },
  ];
  const actual = getListDiff(oldList, newList);
  Assert.deepEqual(actual, expected);
});

add_task(async function test_deleteItemFromMiddle() {
  const { getListDiff } = await import(
    "chrome://browser/content/companion/listDiff.js"
  );
  const oldList = ["A", "B", "C"];
  const newList = ["A", "C"];
  const expected = [
    { type: "move", data: "A", oldIndex: 0 },
    { type: "deletion", data: "B", oldIndex: 1 },
    { type: "move", data: "C", oldIndex: 2 },
  ];
  const actual = getListDiff(oldList, newList);
  Assert.deepEqual(actual, expected);
});

add_task(async function test_deleteItemFromEnd() {
  const { getListDiff } = await import(
    "chrome://browser/content/companion/listDiff.js"
  );
  const oldList = ["A", "B", "C"];
  const newList = ["A", "B"];
  const expected = [
    { type: "move", data: "A", oldIndex: 0 },
    { type: "move", data: "B", oldIndex: 1 },
    { type: "deletion", data: "C", oldIndex: 2 },
  ];
  const actual = getListDiff(oldList, newList);
  Assert.deepEqual(actual, expected);
});

add_task(async function test_insertionWithDeletion() {
  const { getListDiff } = await import(
    "chrome://browser/content/companion/listDiff.js"
  );
  const oldList = ["A", "B", "C"];
  const newList = ["A", "Z", "C"];
  const expected = [
    { type: "move", data: "A", oldIndex: 0 },
    // NOTE: either the deletion or the insertion could come first here. It is
    // really rather arbitrary. It's worth noting however that the decision of
    // how to order this could impact how an animation plays out, and maybe the
    // other way round is better.
    { type: "deletion", data: "B", oldIndex: 1 },
    { type: "insertion", data: "Z" },
    { type: "move", data: "C", oldIndex: 2 },
  ];
  const actual = getListDiff(oldList, newList);
  Assert.deepEqual(actual, expected);
});

add_task(async function test_deletionWithPriorInsertion() {
  const { getListDiff } = await import(
    "chrome://browser/content/companion/listDiff.js"
  );
  const oldList = ["A", "B", "C", "D"];
  const newList = ["Z", "A", "B", "D"];
  const expected = [
    { type: "insertion", data: "Z" },
    { type: "move", data: "A", oldIndex: 0 },
    { type: "move", data: "B", oldIndex: 1 },
    // NOTE: we move the deletion here, even though it occurred at index 2, by
    // the amount of insertions prior to that point. This tends to produce
    // nicer edit scripts, because now the deletion lives between its prior
    // siblings (B and D), and won't jump out of place if we want to animate it
    // out of existence.
    { type: "deletion", data: "C", oldIndex: 2 },
    { type: "move", data: "D", oldIndex: 3 },
  ];
  const actual = getListDiff(oldList, newList);
  Assert.deepEqual(actual, expected);
});

add_task(async function test_insertionWithPriorDeletion() {
  const { getListDiff } = await import(
    "chrome://browser/content/companion/listDiff.js"
  );
  const oldList = ["A", "B", "C", "D"];
  const newList = ["A", "B", "D", "Z"];
  const expected = [
    { type: "move", data: "A", oldIndex: 0 },
    { type: "move", data: "B", oldIndex: 1 },
    { type: "deletion", data: "C", oldIndex: 2 },
    { type: "move", data: "D", oldIndex: 3 },
    { type: "insertion", data: "Z" },
  ];
  const actual = getListDiff(oldList, newList);
  Assert.deepEqual(actual, expected);
});

add_task(async function test_reordering() {
  const { getListDiff } = await import(
    "chrome://browser/content/companion/listDiff.js"
  );
  const oldList = ["A", "B", "C", "D"];
  const newList = ["C", "B", "A", "D"];
  const expected = [
    { type: "move", data: "C", oldIndex: 2 },
    { type: "move", data: "B", oldIndex: 1 },
    { type: "move", data: "A", oldIndex: 0 },
    { type: "move", data: "D", oldIndex: 3 },
  ];
  const actual = getListDiff(oldList, newList);
  Assert.deepEqual(actual, expected);
});

add_task(async function test_chaos() {
  const { getListDiff } = await import(
    "chrome://browser/content/companion/listDiff.js"
  );
  const oldList = ["A", "B", "C", "D", "E", "F", "G", "H"];
  const newList = ["C", "B", "Z", "A", "D", "Y", "G", "X", "Q", "W"];
  const expected = [
    { type: "move", data: "C", oldIndex: 2 },
    { type: "move", data: "B", oldIndex: 1 },
    { type: "insertion", data: "Z" },
    { type: "move", data: "A", oldIndex: 0 },
    { type: "move", data: "D", oldIndex: 3 },
    { type: "deletion", data: "E", oldIndex: 4 },
    { type: "deletion", data: "F", oldIndex: 5 },
    { type: "insertion", data: "Y" },
    { type: "move", data: "G", oldIndex: 6 },
    { type: "deletion", data: "H", oldIndex: 7 },
    { type: "insertion", data: "X" },
    { type: "insertion", data: "Q" },
    { type: "insertion", data: "W" },
  ];
  const actual = getListDiff(oldList, newList);
  Assert.deepEqual(actual, expected);
});
