import assert from "node:assert/strict";
import test from "node:test";

import { moveItem } from "../../src/utils/portfolioDraft.ts";

/** Project order is the order visitors read the work in, so moving one must
 *  never drop, duplicate, or silently reshuffle the others. */

test("moving an item down keeps every other item in order", () => {
  assert.deepEqual(moveItem(["a", "b", "c", "d"], 0, 2), ["b", "c", "a", "d"]);
});

test("moving an item up keeps every other item in order", () => {
  assert.deepEqual(moveItem(["a", "b", "c", "d"], 3, 1), ["a", "d", "b", "c"]);
});

test("a move that goes nowhere returns the original array untouched", () => {
  const items = ["a", "b", "c"];
  assert.equal(moveItem(items, 1, 1), items, "an identity move should not allocate a new array");
});

test("moving past either end clamps instead of throwing or losing the item", () => {
  // "Move up" on the first item, and a drag dropped past the last one.
  assert.deepEqual(moveItem(["a", "b", "c"], 0, -5), ["a", "b", "c"]);
  assert.deepEqual(moveItem(["a", "b", "c"], 0, 99), ["b", "c", "a"]);
});

test("an out-of-range source is ignored rather than corrupting the list", () => {
  const items = ["a", "b"];
  assert.equal(moveItem(items, 5, 0), items);
  assert.equal(moveItem(items, -1, 0), items);
});

test("no item is ever lost or duplicated", () => {
  const items = ["a", "b", "c", "d", "e"];
  for (let from = 0; from < items.length; from += 1) {
    for (let to = 0; to < items.length; to += 1) {
      const moved = moveItem(items, from, to);
      assert.equal(moved.length, items.length);
      assert.deepEqual([...moved].sort(), [...items].sort());
    }
  }
});
