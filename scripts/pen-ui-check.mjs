// UI and brush regression checks for the user-confirmed Millie-style interaction.
export async function runPenUiChecks({
  taskSpace,
  spaceId,
  base,
  outputDirectory,
}) {
  const assert = await import("node:assert/strict");
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const task = await taskSpace(spaceId),
    p = task.page("p1"),
    receipts = [];
  const pass = (check, detail = {}) => {
    const row = { check, passed: true, ...detail };
    receipts.push(row);
    console.log(row);
  };
  await p.goto(base);
  await p.cdp("Emulation.setDeviceMetricsOverride", {
    width: 1500,
    height: 900,
    deviceScaleFactor: 2,
    mobile: false,
  });
  await p.waitForFunction(
    () =>
      window.portableCanvas &&
      !portableCanvas.loading &&
      portableCanvas.canvas.width === 3000,
  );
  const originalSettings = await p.evaluate(() =>
    localStorage.getItem("portable-canvas-settings"),
  );
  const database = "portable-canvas-pen-ui-" + Date.now();
  async function mountTest() {
    await p.evaluate(async (name) => {
      await portableCanvas.destroy();
      const { mount } = await import("./src/widget.js");
      const { DrawingStore } = await import("./src/storage.js");
      window.portableCanvas = mount({
        key: "qa:tools",
        store: new DrawingStore(name),
      });
      await portableCanvas.ready;
      portableCanvas.toggle(true);
      await portableCanvas.ready;
    }, database);
  }
  await mountTest();
  await p.click('loc=css:button[aria-label="Pen"]');
  await p.evaluate(() => {
    const r = portableCanvas.root;
    for (const [id, value] of [
      ["width", 13],
      ["opacity", 70],
    ]) {
      const el = r.querySelector("#" + id);
      el.value = value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
  await p.click('loc=css:button[aria-label="Blue ink"]');
  await p.press('loc=css:input[aria-label="Stroke width"]', "ArrowRight");
  assert.deepEqual(
    await p.evaluate(() => [
      portableCanvas.root.querySelector("#width-value").textContent,
      portableCanvas.root.querySelector("#opacity-value").textContent,
    ]),
    ["14px", "70%"],
  );
  await p.click('loc=css:button[aria-label="Fountain pen"]');
  assert.equal(
    await p.evaluate(
      () => portableCanvas.root.querySelector(".sensitivity").hidden,
    ),
    false,
  );
  await p.evaluate(() => {
    for (const [id, value] of [
      ["width", 20],
      ["sensitivity", 80],
      ["opacity", 90],
    ]) {
      const el = portableCanvas.root.querySelector("#" + id);
      el.value = value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
  await p.click('loc=css:button[aria-label="Purple ink"]');
  await p.click('loc=css:button[aria-label="Pen"]');
  const expectedProfiles = await p.evaluate(
    () => portableCanvas.settings.tools,
  );
  assert.equal(expectedProfiles.pen.width, 14);
  assert.equal(expectedProfiles.pen.opacity, 0.7);
  assert.equal(expectedProfiles.pen.color, "#0066ff");
  assert.equal(expectedProfiles.fountain.sensitivity, 0.8);
  assert.equal(expectedProfiles.fountain.color, "#5731ef");
  pass("Tool-specific sliders, palette and keyboard adjustment");
  await p.click('loc=css:button[aria-label="Close settings"]');
  assert.equal(
    await p.evaluate(
      () => portableCanvas.enabled && !portableCanvas.panel.hidden,
    ),
    false,
  );
  assert.equal(await p.evaluate(() => portableCanvas.enabled), true);
  await p.click('loc=css:button[aria-label="Pen"]');
  assert.equal(await p.evaluate(() => portableCanvas.panel.hidden), false);
  await p.click('loc=css:button[aria-label="Pen"]');
  assert.equal(await p.evaluate(() => portableCanvas.panel.hidden), true);
  pass("Tool tap toggles settings; panel close preserves drawing mode");
  await p.reload();
  await p.waitForFunction(
    () => window.portableCanvas && !portableCanvas.loading,
  );
  await mountTest();
  assert.deepEqual(
    await p.evaluate(() => portableCanvas.settings.tools),
    expectedProfiles,
  );
  pass("Independent pen profiles survive reload");
  await p.click('loc=css:button[aria-label="Highlighter"]');
  await p.evaluate(() => {
    for (const [id, value] of [
      ["width", 24],
      ["opacity", 35],
    ]) {
      const el = portableCanvas.root.querySelector("#" + id);
      el.value = value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
  await p.click('loc=css:button[aria-label="Yellow ink"]');
  await p.click('loc=css:button[aria-label="Close settings"]');
  // One stroke crosses itself. Its alpha must not stack at the intersection.
  await p.mouse.move(420, 230);
  await p.mouse.down();
  await p.mouse.move(620, 330);
  await p.mouse.move(420, 330);
  await p.mouse.move(620, 230);
  await p.mouse.up();
  await p.waitForFunction(
    () =>
      portableCanvas.strokes.length === 1 &&
      portableCanvas.revision === portableCanvas.savedRevision,
  );
  const alphaState = await p.evaluate(() => {
    const c = portableCanvas;
    const alpha = (x, y) =>
      c.ctx.getImageData(Math.round(x * c.dpr), Math.round(y * c.dpr), 1, 1)
        .data[3];
    const d = c.ctx.getImageData(0, 0, c.canvas.width, c.canvas.height).data;
    let max = 0;
    for (let i = 3; i < d.length; i += 4) max = Math.max(max, d[i]);
    return {
      crossing: alpha(520, 280),
      normal: alpha(470, 255),
      max,
      drawing: c.export(),
    };
  });
  assert.equal(alphaState.drawing.strokes[0].tool, "highlighter");
  assert.equal(alphaState.drawing.strokes[0].opacity, 0.35);
  assert.ok(Math.abs(alphaState.crossing - alphaState.normal) <= 1);
  assert.ok(alphaState.max >= 88 && alphaState.max <= 90);
  pass("Highlighter opacity applied once per stroke", {
    crossingAlpha: alphaState.crossing,
    normalAlpha: alphaState.normal,
    maxAlpha: alphaState.max,
  });
  await p.reload();
  await p.waitForFunction(
    () => window.portableCanvas && !portableCanvas.loading,
  );
  await mountTest();
  assert.deepEqual(
    await p.evaluate(() => portableCanvas.export()),
    alphaState.drawing,
  );
  assert.equal(
    await p.evaluate(
      () => portableCanvas.ctx.getImageData(1040, 560, 1, 1).data[3],
    ),
    alphaState.crossing,
  );
  pass("Styled drawing and opacity survive IndexedDB reload");
  await p.click('loc=css:button[aria-label="Eraser"]');
  assert.equal(
    await p.evaluate(
      () =>
        portableCanvas.root.querySelector(".opacity").hidden &&
        portableCanvas.root.querySelector(".colors").hidden,
    ),
    true,
  );
  await p.click('loc=css:button[aria-label="Close settings"]');
  await p.mouse.move(500, 280);
  await p.mouse.down();
  await p.mouse.move(540, 280);
  await p.mouse.up();
  await p.waitForFunction(
    () =>
      portableCanvas.strokes.length === 2 &&
      portableCanvas.revision === portableCanvas.savedRevision,
  );
  assert.equal(
    await p.evaluate(() => portableCanvas.strokes.at(-1).tool),
    "eraser",
  );
  assert.equal(
    await p.evaluate(
      () => portableCanvas.ctx.getImageData(1040, 560, 1, 1).data[3],
    ),
    0,
  );
  await p.click('loc=css:button[aria-label="Undo"]');
  await p.waitForFunction(
    () => portableCanvas.revision === portableCanvas.savedRevision,
  );
  assert.equal(
    await p.evaluate(
      () => portableCanvas.ctx.getImageData(1040, 560, 1, 1).data[3],
    ),
    alphaState.crossing,
  );
  pass("Eraser toolbar input removes ink and undo restores its transparency");
  const rendering = await p.evaluate(async () => {
    const c = portableCanvas,
      make = (tool, sensitivity = 1) => ({
        tool,
        brushVersion: 2,
        color: "#0066ff",
        width: 20,
        opacity: 1,
        sensitivity,
        points: [
          [400, 200, 0.1],
          [400, 300, 0.1],
          [500, 300, 1],
          [500, 200, 1],
        ],
      });
    const data = { format: "portable-canvas", version: 1, strokes: [] };
    const thickness = (x) => {
      const pixels = c.ctx.getImageData(
        x * c.dpr - 40,
        250 * c.dpr,
        80,
        1,
      ).data;
      let count = 0;
      for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 200) count++;
      return count;
    };
    await c.import({ ...data, strokes: [make("pen")] });
    const pen = [thickness(400), thickness(500)];
    await c.import({ ...data, strokes: [make("fountain")] });
    const fountain = [thickness(400), thickness(500)];
    await c.import({ ...data, strokes: [make("fountain", 0)] });
    const insensitive = [thickness(400), thickness(500)];
    await c.import({
      ...data,
      strokes: [
        make("pen"),
        {
          tool: "eraser",
          color: "#000000",
          width: 24,
          opacity: 1,
          points: [
            [380, 250, 0.5],
            [420, 250, 0.5],
          ],
        },
      ],
    });
    const erased = thickness(400);
    c.undo();
    await c.save();
    const restored = thickness(400);
    // Exercise replay performance for new styled strokes, not only legacy data.
    const sample = {
      ...data,
      strokes: Array.from({ length: 1000 }, (_, i) => ({
        tool: "highlighter",
        brushVersion: 2,
        color: "#fff000",
        width: 12,
        opacity: 0.35,
        sensitivity: 0,
        points: Array.from({ length: 20 }, (_, j) => [
          400 + j * 5,
          150 + (i % 300),
          0.5,
        ]),
      })),
    };
    const start = performance.now();
    await c.import(sample);
    const sampleMs = Math.round(performance.now() - start);
    return { pen, fountain, insensitive, erased, restored, sampleMs };
  });
  assert.equal(rendering.pen[0], rendering.pen[1]);
  assert.ok(rendering.fountain[0] < rendering.fountain[1] / 2);
  assert.equal(rendering.insensitive[0], rendering.insensitive[1]);
  pass(
    "Pen, fountain and sensitivity produce distinct pressure behavior",
    rendering,
  );
  assert.equal(rendering.erased, 0);
  assert.equal(rendering.restored, rendering.pen[0]);
  pass("Eraser with optional style data and undo remain correct");
  await p.click('loc=css:button[aria-label="Close drawing"]');
  assert.equal(
    await p.evaluate(
      () =>
        !portableCanvas.enabled &&
        portableCanvas.toolbar.hidden &&
        !portableCanvas.root.querySelector(".toggle").hidden,
    ),
    true,
  );
  pass("Close returns to the single pen icon");
  await p.evaluate((s) => {
    if (s === null) localStorage.removeItem("portable-canvas-settings");
    else localStorage.setItem("portable-canvas-settings", s);
  }, originalSettings);
  await fs.mkdir(outputDirectory, { recursive: true });
  await fs.writeFile(
    path.join(outputDirectory, "pen-ui-checks.json"),
    JSON.stringify(
      {
        date: new Date().toISOString(),
        browser: "Ego Lite Chromium",
        receipts,
        limitations: [
          "Hardware stylus feel not tested. Reference is user-confirmed 2024 published screenshot, not latest-app hands-on.",
        ],
      },
      null,
      2,
    ) + "\n",
  );
}
