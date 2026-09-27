import test from "node:test";
import assert from "node:assert/strict";
import { validateDrawing } from "../src/model.js";
const stroke = {
  tool: "pen",
  color: "#123456",
  width: 4,
  points: [
    [0, 0, 0.5],
    [10, 20, 1],
  ],
};

test("extended brush fields round trip without changing legacy backups", () => {
  const backup = (strokes) => ({
    format: "portable-canvas",
    version: 1,
    strokes,
  });
  const modern = ["pen", "fountain", "highlighter", "eraser"].map((tool) => ({
    ...stroke,
    tool,
    brushVersion: 2,
    opacity: 0.35,
    sensitivity: 0.7,
  }));
  assert.deepEqual(validateDrawing(backup(modern)), modern);
  assert.deepEqual(validateDrawing(backup([stroke])), [stroke]);
  for (const field of ["opacity", "sensitivity"])
    for (const value of [-0.1, 1.1, NaN, Infinity, "0.5", null])
      assert.throws(() =>
        validateDrawing(backup([{ ...stroke, [field]: value }])),
      );
  assert.throws(() =>
    validateDrawing(backup([{ ...stroke, brushVersion: 3 }])),
  );
});

test("per-tool settings are isolated, bounded, and preserve existing retention", async () => {
  const { toolSettings, validatedSettings } = await import("../src/model.js");
  const legacy = validatedSettings({
    width: 8,
    color: "#123456",
    maxPages: 12,
    maxBytes: 2048,
    input: "pen",
  });
  const tools = toolSettings(undefined, legacy);
  assert.equal(tools.pen.width, 8);
  assert.equal(tools.highlighter.opacity, 0.35);
  tools.pen.width = 33;
  assert.equal(tools.fountain.width, 8);
  const saved = validatedSettings({ ...legacy, tools });
  assert.equal(saved.tools.pen.width, 33);
  assert.equal(saved.maxPages, 12);
  assert.equal(saved.maxBytes, 2048);
  assert.equal(saved.input, "pen");
  assert.equal(
    toolSettings({ fountain: { sensitivity: Infinity } }).fountain.sensitivity,
    0.5,
  );
});

test("legacy pressure remains exact while modern pens and fountain differ", async () => {
  const { strokeWidth } = await import("../src/model.js");
  for (const pressure of [0, 0.1, 0.5, 1]) {
    assert.equal(
      strokeWidth(stroke, pressure),
      stroke.width * (0.35 + pressure * 0.65),
    );
    assert.equal(
      strokeWidth({ ...stroke, brushVersion: 2 }, pressure),
      stroke.width,
    );
  }
  const fountain = {
    ...stroke,
    tool: "fountain",
    brushVersion: 2,
    sensitivity: 1,
  };
  assert.ok(strokeWidth(fountain, 0.1) < strokeWidth(fountain, 1));
  assert.equal(strokeWidth({ ...fountain, sensitivity: 0 }, 0.1), stroke.width);
});
