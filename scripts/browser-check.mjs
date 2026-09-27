// Called by scripts/run-browser-check.mjs through the Ego browser runtime.
export async function runBrowserChecks({
  taskSpace,
  spaceId,
  base,
  outputDirectory,
}) {
  const assert = await import("node:assert/strict");
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const task = await taskSpace(spaceId);
  const p = task.page("p1");
  const receipts = [];
  function pass(check, detail = {}) {
    const row = { check, passed: true, ...detail };
    receipts.push(row);
    console.log(row);
  }
  await p.goto(base);
  await p.cdp("Emulation.setDeviceMetricsOverride", {
    width: 1500,
    height: 900,
    deviceScaleFactor: 2,
    mobile: false,
  });
  await p.waitForFunction(
    () => window.portableCanvas && !portableCanvas.loading,
  );
  // Independent DB prevents retention checks from evicting drawings in the demo collection.
  await p.evaluate(async () => {
    await portableCanvas.destroy();
    const { mount } = await import("./src/widget.js");
    const { DrawingStore } = await import("./src/storage.js");
    window.portableCanvas = mount({
      key: "qa:ink",
      store: new DrawingStore("portable-canvas-browser-qa-" + Date.now()),
    });
    await portableCanvas.ready;
    portableCanvas.toggle(true);
    await portableCanvas.ready;
  });
  // Browser-delivered stylus events: no dependence on a hardware brand identifier.
  await p.cdp("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: 540,
    y: 250,
    button: "left",
    buttons: 1,
    clickCount: 1,
    pointerType: "pen",
    force: 0.2,
  });
  for (let x = 550; x <= 700; x += 10)
    await p.cdp("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x,
      y: 250 + (x - 550) / 5,
      button: "left",
      buttons: 1,
      pointerType: "pen",
      force: 0.8,
    });
  await p.cdp("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: 710,
    y: 282,
    button: "left",
    buttons: 0,
    clickCount: 1,
    pointerType: "pen",
    force: 0,
  });
  await p.waitForFunction(
    () =>
      portableCanvas.strokes.length === 1 &&
      portableCanvas.revision === portableCanvas.savedRevision,
  );
  const stylus = await p.evaluate(() => ({
    pressures: [...new Set(portableCanvas.strokes[0].points.map((p) => p[2]))],
    points: portableCanvas.strokes[0].points.length,
  }));
  assert.ok(stylus.pressures.includes(0.2));
  assert.ok(stylus.pressures.includes(0.8));
  pass("Stylus pressure and autosave", stylus);
  await p.cdp("Emulation.setTouchEmulationEnabled", {
    enabled: true,
    maxTouchPoints: 5,
  });
  await p.cdp("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 550, y: 350, id: 1 }],
  });
  await p.cdp("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: 670, y: 380, id: 1 }],
  });
  await p.cdp("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await p.waitForFunction(
    () =>
      portableCanvas.strokes.length === 2 &&
      portableCanvas.revision === portableCanvas.savedRevision,
  );
  pass("Finger touch drawing and autosave");
  await p.click('loc=css:button[data-action="input"]');
  await p.cdp("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 560, y: 420, id: 2 }],
  });
  await p.cdp("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: 660, y: 450, id: 2 }],
  });
  await p.cdp("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  assert.equal(await p.evaluate(() => portableCanvas.strokes.length), 2);
  pass("Pen-only mode ignores finger contact");
  await p.click('loc=css:button[data-action="input"]');
  const result = await p.evaluate(async () => {
    const c = portableCanvas,
      results = {};
    const ink = () => {
      const d = c.ctx.getImageData(0, 0, c.canvas.width, c.canvas.height).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i]) n++;
      return n;
    };
    const original = c.export();
    c.render();
    const before = ink();
    results.inkBefore = before;
    await c.import({
      ...original,
      strokes: [
        ...original.strokes,
        {
          tool: "eraser",
          color: "#000000",
          width: 100,
          points: [
            [550, 250, 1],
            [710, 282, 1],
          ],
        },
      ],
    });
    results.eraser = ink() < before;
    c.undo();
    await c.save();
    results.inkUndo = ink(); // Canvas readback can switch raster backends; tolerate <=0.1% edge pixels, but require exact stroke restoration.
    results.undo =
      Math.abs(ink() - before) <= Math.max(4, before * 0.001) &&
      JSON.stringify(c.strokes) === JSON.stringify(original.strokes);
    c.redo();
    await c.save();
    results.redo = ink() < before;
    await c.import(original);
    results.backup =
      JSON.stringify(c.export().strokes) === JSON.stringify(original.strokes);
    try {
      await c.import({
        ...original,
        strokes: [{ tool: "pen", color: "bad", width: 4, points: [[1, 2, 1]] }],
      });
      results.invalid = false;
    } catch {
      results.invalid =
        JSON.stringify(c.export().strokes) === JSON.stringify(original.strokes);
    }
    // Save rejection must keep the active key and drawing available.
    const realSave = c.store.save.bind(c.store);
    c.store.save = async () => {
      throw new DOMException("Injected full disk", "QuotaExceededError");
    };
    c.strokes.push({
      tool: "pen",
      color: "#123456",
      width: 4,
      points: [[800, 300, 0.5]],
    });
    c.pointCount++;
    c.changed();
    const key = c.key,
      count = c.strokes.length;
    results.failedSwitch =
      !(await c.setPage("qa:blocked")) &&
      c.key === key &&
      c.strokes.length === count &&
      c.savedRevision !== c.revision &&
      c.statusEl.textContent.includes("Not saved");
    c.store.save = realSave;
    results.retry = await c.save();
    // Access LRU and count limit in real IndexedDB.
    c.setRetention(2, 1024 * 1024);
    await c.setPage("qa:b");
    await c.import(original);
    await c.setPage("qa:ink"); // touch ink to make b oldest
    await new Promise((r) => setTimeout(r, 5));
    await c.setPage("qa:c");
    await c.import(original);
    const rows = await c.store.recents();
    results.retention =
      rows.length === 2 &&
      rows.some((r) => r.key === "qa:ink") &&
      !rows.some((r) => r.key === "qa:b");
    // Real competing store write causes a conflict, never silent overwrite.
    const { DrawingStore } = await import("./src/storage.js");
    const peer = new DrawingStore(c.store.name);
    const remote = await peer.load(c.key);
    await peer.save(c.key, [], remote.version, c.settings);
    c.changed();
    results.conflict =
      !(await c.save()) &&
      c.statusEl.textContent.includes("Another window") &&
      c.strokes.length > 0;
    peer.close();
    // Recover by explicit load only after preserving export in the test.
    await c.load(c.key);
    await c.import(original);
    const t = performance.now();
    const large = {
      ...original,
      strokes: Array.from({ length: 1000 }, (_, i) => ({
        tool: "pen",
        color: "#272923",
        width: 2,
        points: Array.from({ length: 20 }, (_, j) => [
          400 + j * 5,
          160 + (i % 300),
          0.5,
        ]),
      })),
    };
    await c.import(large);
    results.sampleMs = Math.round(performance.now() - t);
    results.samplePoints = c.pointCount;
    c.settings.input = "all";
    c.setRetention(50, 50 * 1024 * 1024);
    c.persistSettings();
    return results;
  });
  console.log({ diagnostics: result });
  for (const check of [
    "eraser",
    "undo",
    "redo",
    "backup",
    "invalid",
    "failedSwitch",
    "retry",
    "retention",
    "conflict",
  ]) {
    assert.equal(result[check], true, check);
    pass(check);
  }
  assert.equal(result.samplePoints, 20000);
  pass("20,000-point sample import, render and committed save", {
    elapsedMs: result.sampleMs,
  });
  await p.cdp("Emulation.setTouchEmulationEnabled", { enabled: false });
  await p.evaluate(() => portableCanvas.toggle(false));
  await fs.mkdir(outputDirectory, { recursive: true });
  await fs.writeFile(
    path.join(outputDirectory, "browser-checks.json"),
    JSON.stringify(
      {
        date: new Date().toISOString(),
        browser: "Ego Lite Chromium",
        receipts,
        limitations: [
          "Synthetic stylus and touch inputs do not establish physical iPad or Android performance.",
        ],
      },
      null,
      2,
    ) + "\n",
  );
}
