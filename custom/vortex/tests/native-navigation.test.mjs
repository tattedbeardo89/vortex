import test from "node:test";
import assert from "node:assert/strict";
import {
  SIDEBAR,
  destination,
  currentSection,
  CONTENT,
  adjacentSection,
  contentFocus,
} from "../native/navigation.js";
test("native platform destinations use original array-valued filters and preserve unrelated eligibility rules", () => {
  const base = { platform: [], provider: [], genre: [], wishlist: false };
  const calls = [];
  const actions = { show: (...x) => calls.push(x) };
  destination("ps4", base, actions, () => {});
  assert.deepEqual(calls[0][0], { ...base, platform: ["ps4"] });
  assert.deepEqual(base.platform, []);
  assert.equal(currentSection("browse", "catalog", calls[0][0]), "ps4");
  assert.equal(currentSection("game", null, calls[0][0]), null);
  assert.equal(SIDEBAR.length, 8);
  assert.equal(CONTENT.left, 320);
  assert.equal(CONTENT.right, 32);
});

test("one registry cycles forward and backward through every visible primary section including wrapping", () => {
  const expected = [
    "discover",
    "catalog",
    "ps5",
    "ps4",
    "homebrew",
    "favorites",
    "downloads",
    "settings",
  ];
  assert.deepEqual(
    SIDEBAR.map((row) => row.id),
    expected,
  );
  for (let i = 0; i < expected.length; i++) {
    assert.equal(
      adjacentSection(expected[i], true),
      expected[(i + 1) % expected.length],
    );
    assert.equal(
      adjacentSection(expected[i], false),
      expected[(i + expected.length - 1) % expected.length],
    );
    assert.ok(contentFocus(expected[i]));
    assert.notEqual(adjacentSection(expected[i], true), "files");
  }
  assert.equal(currentSection("downloads", "downloads", {}, true), "settings");
  assert.equal(adjacentSection("top", true), "discover");
  assert.equal(adjacentSection("files", false), "settings");
});
