import test from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { DrawingStore } from "../src/storage.js";
import {
  DEFAULTS,
  retentionPlan,
  validateDrawing,
  safeAddress,
} from "../src/model.js";
const stroke = {
  tool: "pen",
  color: "#123456",
  width: 4,
  points: [
    [0, 0, 0.5],
    [10, 20, 1],
  ],
};
test("storage round trip, metadata and version conflict preserve original", async () => {
  const s = new DrawingStore("roundtrip");
  assert.equal((await s.load("a")).version, 0);
  assert.equal(await s.save("a", [stroke], 0, DEFAULTS), 1);
  await assert.rejects(s.save("a", [], 0, DEFAULTS), /Another window/);
  assert.deepEqual((await s.load("a")).strokes, [stroke]);
  const [meta] = await s.recents();
  assert.equal(meta.strokes, undefined);
  assert.ok(meta.bytes > 0);
  s.close();
});
test("atomic LRU count retention and oversized active save protection", async () => {
  const s = new DrawingStore("retention");
  await s.save("a", [stroke], 0, DEFAULTS);
  await s.save("b", [stroke], 0, DEFAULTS);
  await s.save("c", [stroke], 0, { ...DEFAULTS, maxPages: 2 });
  assert.deepEqual((await s.recents()).map((r) => r.key).sort(), ["b", "c"]);
  await assert.rejects(
    s.save("c", [stroke], 1, { ...DEFAULTS, maxBytes: 1 }),
    /budget/,
  );
  assert.deepEqual((await s.recents()).map((r) => r.key).sort(), ["b", "c"]);
  assert.equal((await s.load("c")).version, 1);
  s.close();
});
test("retention follows access time and byte budget", () => {
  assert.deepEqual(
    retentionPlan(
      [
        { key: "b", bytes: 30, accessed: 2 },
        { key: "a", bytes: 30, accessed: 1 },
      ],
      "c",
      30,
      { maxBytes: 60, maxPages: 50 },
    ),
    ["a"],
  );
});
test("backup validation rejects malformed input, preserving valid copy", () => {
  assert.deepEqual(
    validateDrawing({
      format: "portable-canvas",
      version: 1,
      strokes: [stroke],
    }),
    [stroke],
  );
  for (const invalid of [
    { ...stroke, width: NaN },
    { ...stroke, color: "red" },
    { ...stroke, points: [[1, 2, Infinity]] },
    { ...stroke, tool: "script" },
  ])
    assert.throws(() =>
      validateDrawing({
        format: "portable-canvas",
        version: 1,
        strokes: [invalid],
      }),
    );
});
test("address validation allows only credential-free web URLs", () => {
  assert.equal(safeAddress("example.com"), "https://example.com/");
  assert.throws(() => safeAddress("javascript://alert(1)"));
  assert.throws(() => safeAddress("https://user:pass@example.com"));
});

test("persisted settings reject unsafe markup and invalid limits", async () => {
  const { validatedSettings } = await import("../src/model.js");
  assert.deepEqual(
    validatedSettings({
      color: '"><img src=x>',
      width: -1,
      input: "touch",
      maxPages: 0,
      maxBytes: Infinity,
    }),
    DEFAULTS,
  );
  assert.deepEqual(validatedSettings(null), DEFAULTS);
});
