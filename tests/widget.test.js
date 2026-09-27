import test from "node:test";
import assert from "node:assert/strict";
import { PortableCanvas } from "../src/widget.js";
const stroke = {
  tool: "pen",
  color: "#123456",
  width: 4,
  points: [[1, 2, 0.5]],
};
function instance(store) {
  const c = Object.create(PortableCanvas.prototype);
  Object.assign(c, {
    store,
    key: "page:a",
    strokes: [structuredClone(stroke)],
    revision: 1,
    savedRevision: 0,
    version: 0,
    queue: Promise.resolve(),
    settings: {},
    status(text) {
      this.lastStatus = text;
    },
  });
  return c;
}
test("save remains dirty when edits arrive during transaction, then queued save commits newest revision", async () => {
  let release;
  const writes = [];
  const c = instance({
    async save(key, strokes, version) {
      writes.push({ key, strokes, version });
      if (writes.length === 1) await new Promise((r) => (release = r));
      return version + 1;
    },
  });
  const first = c.save();
  await new Promise((r) => setImmediate(r));
  assert.equal(c.lastStatus, "Saving…");
  c.strokes[0].points.push([3, 4, 0.5]);
  c.revision++;
  release();
  assert.equal(await first, true);
  assert.equal(c.savedRevision, 1);
  assert.equal(c.lastStatus, "Unsaved changes");
  assert.equal(writes[0].strokes[0].points.length, 1);
  assert.equal(await c.save(), true);
  assert.equal(c.version, 2);
  assert.equal(c.savedRevision, 2);
  assert.equal(c.lastStatus, "Saved locally");
});
test("save failure preserves dirty state and blocks page switch", async () => {
  const c = instance({
    async save() {
      throw new Error("quota");
    },
  });
  c.finish = () => {};
  assert.equal(await c.setPage("page:b"), false);
  assert.equal(c.key, "page:a");
  assert.equal(c.strokes.length, 1);
  assert.equal(c.savedRevision, 0);
  assert.equal(c.loading, false);
  assert.match(c.lastStatus, /Not saved/);
});
test("mutating controls are guarded during page transitions", () => {
  const c = instance({});
  c.loading = true;
  c.redoStack = [stroke];
  c.undo();
  c.redo();
  c.clear();
  assert.equal(c.strokes.length, 1);
  assert.throws(() => c.import({}), /Wait/);
});
test("failed page load preserves previous key and strokes", async () => {
  const c = instance({
    async load() {
      throw new Error("unavailable");
    },
  });
  assert.equal(await c.load("page:b"), false);
  assert.equal(c.key, "page:a");
  assert.equal(c.strokes.length, 1);
});

test("same-key page requests cannot bypass a pending transition", async () => {
  const c = instance({});
  c.loading = true;
  assert.equal(await c.setPage("page:a"), false);
});

test("continuing a checkpointed stroke marks new points unsaved only once", () => {
  const c = instance({});
  c.savedRevision = c.revision;
  c.active = { id: 1, stroke: c.strokes[0] };
  c.pointCount = 1;
  c.frame = 1;
  c.coords = (event) => [event.x, 2, 0.5];
  const statuses = [];
  c.status = (text) => statuses.push(text);
  c.move({ pointerId: 1, x: 10, preventDefault() {} });
  c.move({ pointerId: 1, x: 20, preventDefault() {} });
  assert.deepEqual(statuses, ["Unsaved changes"]);
  assert.equal(c.revision, c.savedRevision + 2);
  assert.equal(c.active.stroke.points.length, 3);
});

test("opacity is applied once when compositing a stroke mask and reset afterward", () => {
  const c = instance({});
  c.mask = {};
  const calls = [];
  const context = {
    setTransform() {},
    drawImage() {
      calls.push({
        alpha: this.globalAlpha,
        operation: this.globalCompositeOperation,
      });
    },
  };
  c.composite(context, { ...stroke, opacity: 0.35 });
  c.composite(context, { ...stroke, tool: "eraser", opacity: 0.2 });
  assert.deepEqual(calls, [
    { alpha: 0.35, operation: "source-over" },
    { alpha: 1, operation: "destination-out" },
  ]);
  assert.equal(context.globalAlpha, 1);
  assert.equal(context.globalCompositeOperation, "source-over");
});

test("invalid optional brush fields reject before replacing existing work", () => {
  const c = instance({});
  const before = structuredClone(c.strokes);
  assert.throws(() =>
    c.import({
      format: "portable-canvas",
      version: 1,
      strokes: [{ ...stroke, opacity: Infinity }],
    }),
  );
  assert.deepEqual(c.strokes, before);
  assert.equal(c.revision, 1);
});
