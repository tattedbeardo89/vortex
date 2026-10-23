import test from "node:test";
import assert from "node:assert/strict";
import {
  SIDEBAR,
  destination,
  currentSection,
  CONTENT,
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
