import {
  DEFAULTS,
  pageKey,
  validateDrawing,
  validatedSettings,
  toolSettings,
  TOOLS,
  strokeWidth,
} from "./model.js";
import { DrawingStore } from "./storage.js";
import { markup, labels } from "./ui.js";
export function mount(options = {}) {
  return new PortableCanvas(options);
}
export class PortableCanvas {
  constructor({
    target = document.body,
    key = pageKey(),
    mode = "document",
    store = new DrawingStore(),
    onStatus = () => {},
  } = {}) {
    this.target = target;
    this.key = key;
    this.mode = mode;
    this.store = store;
    this.onStatus = onStatus;
    this.strokes = [];
    this.pointCount = 0;
    this.redoStack = [];
    this.revision = 0;
    this.savedRevision = 0;
    this.version = 0;
    this.enabled = false;
    this.loading = true;
    this.queue = Promise.resolve();
    this.settings = { ...DEFAULTS };
    try {
      this.settings = validatedSettings(
        JSON.parse(localStorage.getItem("portable-canvas-settings") || "{}"),
      );
    } catch {}
    this.tool = "pen";
    this.host = document.createElement("portable-canvas");
    this.host.style.cssText =
      "position:fixed;inset:0;pointer-events:none;z-index:2147483000";
    target.append(this.host);
    this.root = this.host.attachShadow({ mode: "open" });
    this.root.innerHTML = markup();
    this.settings.tools = toolSettings(this.settings.tools, this.settings);
    this.panel = this.root.querySelector(".panel");
    for (const control of this.root.querySelectorAll("[aria-label]")) {
      control.title = control.getAttribute("aria-label");
    }
    this.canvas = this.root.querySelector("canvas");
    this.ctx = this.canvas.getContext("2d");
    this.committed = document.createElement("canvas");
    this.mask = document.createElement("canvas");
    this.statusEl = this.root.querySelector(".status");
    this.toolbar = this.root.querySelector(".controls");
    this.abort = new AbortController();
    const listen = (el, event, fn, opts = {}) =>
      el.addEventListener(event, fn, { ...opts, signal: this.abort.signal });
    listen(this.root.querySelector(".toggle"), "click", () => this.toggle());
    for (const b of this.root.querySelectorAll("[data-action]"))
      listen(b, "click", () => {
        const action = b.dataset.action;
        if (TOOLS.includes(action)) {
          this.finish();
          this.panel.hidden = this.tool === action ? !this.panel.hidden : false;
          this.tool = action;
          this.updateTools();
        } else if (action === "close-panel") this.panel.hidden = true;
        else if (action === "close") this.toggle(false);
        else if (action === "input") {
          this.settings.input = this.settings.input === "pen" ? "all" : "pen";
          this.updateTools();
          this.persistSettings();
        } else this[action]();
      });
    for (const field of ["width", "opacity", "sensitivity"]) {
      listen(this.root.querySelector(`#${field}`), "input", (e) => {
        this.settings.tools[this.tool][field] =
          Number(e.target.value) / (field === "width" ? 1 : 100);
        this.updateTools();
        this.persistSettings();
      });
    }
    const setColor = (color) => {
      this.settings.tools[this.tool].color = color;
      this.updateTools();
      this.persistSettings();
    };
    listen(this.root.querySelector("input[type=color]"), "input", (e) =>
      setColor(e.target.value),
    );
    for (const button of this.root.querySelectorAll("[data-color]"))
      listen(button, "click", () => setColor(button.dataset.color));
    this.updateTools();
    listen(this.canvas, "pointerdown", (e) => this.down(e));
    listen(this.canvas, "pointermove", (e) => this.move(e));
    listen(this.canvas, "pointerup", (e) => this.up(e));
    listen(this.canvas, "pointercancel", () => this.finish());
    listen(this.canvas, "lostpointercapture", (e) => {
      if (e.pointerId === this.active?.id) this.finish();
    });
    listen(window, "keydown", (event) => {
      const editing = event
        .composedPath()
        .some(
          (element) =>
            element instanceof HTMLElement &&
            (element.matches("input, select, textarea") ||
              element.isContentEditable),
        );
      if (event.key === "Escape" && this.enabled && !editing) {
        if (!this.panel.hidden) this.panel.hidden = true;
        else this.toggle(false);
      }
    });
    listen(window, "resize", () => this.resize());
    listen(window, "scroll", () => this.scheduleRender(), { passive: true });
    listen(document, "visibilitychange", () => {
      if (document.hidden) this.save();
    });
    listen(window, "pagehide", () => this.save());
    this.interval = setInterval(() => {
      if (this.revision !== this.savedRevision) this.save();
    }, 5000);
    this.resize();
    this.ready = this.load(key);
  }
  updateTools() {
    const settings = this.settings.tools[this.tool];
    this.panel.querySelector("h2").textContent = labels[this.tool];
    this.panel.querySelector(".sensitivity").hidden = this.tool !== "fountain";
    this.panel.querySelector(".opacity").hidden = this.tool === "eraser";
    this.panel.querySelector(".colors").hidden = this.tool === "eraser";
    for (const tool of TOOLS)
      this.root
        .querySelector(`[data-action=${tool}]`)
        .setAttribute("aria-pressed", String(tool === this.tool));
    this.root
      .querySelector("[data-action=input]")
      .setAttribute("aria-pressed", String(this.settings.input === "pen"));
    for (const field of ["width", "opacity", "sensitivity"]) {
      const input = this.root.querySelector(`#${field}`);
      if (field === "width") input.max = this.tool === "eraser" ? 100 : 64;
      input.value = settings[field] * (field === "width" ? 1 : 100);
      input.style.setProperty(
        "--fill",
        `${((input.value - input.min) / (input.max - input.min)) * 100}%`,
      );
      this.root.querySelector(`#${field}-value`).textContent =
        `${Math.round(input.value)}${field === "width" ? "px" : "%"}`;
    }
    this.root.querySelector("input[type=color]").value = settings.color;
    for (const button of this.root.querySelectorAll("[data-color]"))
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.color === settings.color.toLowerCase()),
      );
  }
  status(text) {
    this.statusEl.textContent = text;
    this.statusEl.hidden = !this.enabled && text === "Saved locally";
    this.onStatus(text);
  }
  persistSettings() {
    try {
      localStorage.setItem(
        "portable-canvas-settings",
        JSON.stringify(this.settings),
      );
    } catch {
      this.status("Settings could not be stored.");
    }
  }
  setRetention(maxPages, maxBytes) {
    if (
      !Number.isInteger(maxPages) ||
      maxPages < 1 ||
      maxPages > 10000 ||
      !Number.isFinite(maxBytes) ||
      maxBytes < 1024 ||
      maxBytes > 1024 * 1024 * 1000
    )
      throw new Error(
        "Enter a positive page limit and a budget of at least 1 KB.",
      );
    Object.assign(this.settings, { maxPages, maxBytes });
    this.persistSettings();
  }
  async load(key) {
    this.loading = true;
    try {
      const data = await this.store.load(key);
      this.key = key;
      this.strokes = data.strokes;
      this.pointCount = this.strokes.reduce((n, s) => n + s.points.length, 0);
      this.version = data.version;
      this.redoStack = [];
      this.revision = 0;
      this.savedRevision = 0;
      this.status("Saved locally");
      this.render();
      return true;
    } catch (e) {
      this.status(
        `Storage unavailable: ${e.message}. Export your work before leaving.`,
      );
      return false;
    } finally {
      this.loading = false;
    }
  }
  async setPage(key) {
    if (this.loading) return false;
    if (key === this.key) return true;
    this.finish();
    this.loading = true;
    const ok = await this.save();
    if (!ok) {
      this.loading = false;
      return false;
    }
    return this.load(key);
  }
  toggle(force = !this.enabled) {
    if (
      force &&
      !this.enabled &&
      !this.loading &&
      this.revision === this.savedRevision
    ) {
      this.ready = this.load(this.key);
    }
    this.enabled = force;
    this.statusEl.hidden =
      !force && this.statusEl.textContent === "Saved locally";
    this.canvas.style.pointerEvents = force ? "auto" : "none";
    this.canvas.style.touchAction = force ? "none" : "auto";
    this.toolbar.hidden = !force;
    this.root
      .querySelector(".toggle")
      .setAttribute("aria-pressed", String(force));
    this.root.querySelector(".toggle").hidden = force;
    if (!force) {
      this.panel.hidden = true;
      this.finish();
    }
  }
  coords(e) {
    const rect = this.canvas.getBoundingClientRect();
    return [
      Math.round(
        (e.clientX -
          rect.left +
          (this.mode === "document" ? window.scrollX : 0)) *
          10,
      ) / 10,
      Math.round(
        (e.clientY -
          rect.top +
          (this.mode === "document" ? window.scrollY : 0)) *
          10,
      ) / 10,
      Math.round((e.pressure > 0 ? e.pressure : 0.5) * 100) / 100,
    ];
  }
  down(e) {
    if (
      this.loading ||
      this.active ||
      !this.enabled ||
      e.button !== 0 ||
      (this.settings.input === "pen" && e.pointerType !== "pen")
    )
      return;
    e.preventDefault();
    this.active = {
      id: e.pointerId,
      stroke: {
        tool: this.tool,
        ...this.settings.tools[this.tool],
        brushVersion: 2,
        points: [this.coords(e)],
      },
    };
    if (this.strokes.length >= 20000 || this.pointCount >= 1000000) {
      this.active = null;
      this.status(
        "Stroke limit reached. Export your work and start a new page.",
      );
      return;
    }
    this.strokes.push(this.active.stroke);
    this.pointCount++;
    this.redoStack = [];
    this.canvas.setPointerCapture(e.pointerId);
    this.changed();
    this.clearCanvas(this.mask);
    this.drawDot(
      this.active.stroke,
      this.active.stroke.points[0],
      this.mask.getContext("2d"),
    );
    this.present();
  }
  move(e) {
    if (!this.active || e.pointerId !== this.active.id) return;
    e.preventDefault();
    const events = e.getCoalescedEvents?.() || [e];
    for (const p of events.length ? events : [e]) {
      const point = this.coords(p),
        last = this.active.stroke.points.at(-1);
      if (Math.hypot(point[0] - last[0], point[1] - last[1]) < 0.4) continue;
      if (this.pointCount >= 1000000) {
        this.finish();
        this.status(
          "Point limit reached. Export your work and start a new page.",
        );
        break;
      }
      this.active.stroke.points.push(point);
      this.pointCount++;
      this.pending ??= [];
      this.pending.push([this.active.stroke, last, point]);
      const wasSaved = this.revision === this.savedRevision;
      this.revision++;
      if (wasSaved) this.status("Unsaved changes");
    }
    if (!this.frame)
      this.frame = requestAnimationFrame(() => {
        this.frame = null;
        for (const [s, a, b] of this.pending || [])
          this.drawSegment(s, a, b, this.mask.getContext("2d"));
        this.present();
        this.pending = [];
      });
  }
  up(e) {
    if (e.pointerId === this.active?.id) {
      this.move(e);
      this.finish();
    }
  }
  finish() {
    if (!this.active) return;
    for (const [s, a, b] of this.pending || [])
      this.drawSegment(s, a, b, this.mask.getContext("2d"));
    this.pending = [];
    this.composite(this.committed.getContext("2d"), this.active.stroke);
    this.active = null;
    this.present();
    this.changed();
  }
  changed() {
    this.revision++;
    this.status("Unsaved changes");
    clearTimeout(this.debounce);
    this.debounce = setTimeout(() => this.save(), 400);
  }
  undo() {
    if (this.loading) return;
    this.finish();
    if (this.strokes.length) {
      const stroke = this.strokes.pop();
      this.pointCount -= stroke.points.length;
      this.redoStack.push(stroke);
      this.changed();
      this.render();
    }
  }
  redo() {
    if (this.loading) return;
    if (this.redoStack.length) {
      const stroke = this.redoStack.pop();
      this.pointCount += stroke.points.length;
      this.strokes.push(stroke);
      this.changed();
      this.render();
    }
  }
  clear() {
    if (this.loading) return;
    this.finish();
    this.strokes = [];
    this.pointCount = 0;
    this.redoStack = [];
    this.changed();
    this.render();
  }
  save() {
    const operation = async () => {
      if (this.revision === this.savedRevision) return true;
      const revision = this.revision,
        key = this.key,
        snapshot = structuredClone(this.strokes);
      this.status("Saving…");
      try {
        this.version = await this.store.save(
          key,
          snapshot,
          this.version,
          this.settings,
        );
        this.savedRevision = revision;
        this.status(
          this.revision === revision ? "Saved locally" : "Unsaved changes",
        );
        return true;
      } catch (e) {
        this.status(`Not saved: ${e.message} Export your work before leaving.`);
        return false;
      }
    };
    this.queue = this.queue.then(operation, operation);
    return this.queue;
  }
  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.dpr = dpr;
    for (const canvas of [this.canvas, this.committed, this.mask]) {
      canvas.width = Math.round(innerWidth * dpr);
      canvas.height = Math.round(innerHeight * dpr);
    }
    this.render();
  }
  clearCanvas(canvas) {
    const c = canvas.getContext("2d");
    c.setTransform(1, 0, 0, 1, 0, 0);
    if (canvas === this.mask && this.maskBounds)
      c.clearRect(...this.maskBounds);
    else c.clearRect(0, 0, canvas.width, canvas.height);
    if (canvas === this.mask) this.maskBounds = null;
  }
  prepare(s, c) {
    c.setTransform(
      this.dpr,
      0,
      0,
      this.dpr,
      this.mode === "document" ? -scrollX * this.dpr : 0,
      this.mode === "document" ? -scrollY * this.dpr : 0,
    );
    c.globalAlpha = 1;
    c.globalCompositeOperation =
      c.canvas === this.committed && s.brushVersion !== 2 && s.tool === "eraser"
        ? "destination-out"
        : "source-over";
    c.strokeStyle = s.color;
    c.fillStyle = s.color;
    c.lineCap = "round";
    c.lineJoin = "round";
  }
  drawDot(s, p, c) {
    this.prepare(s, c);
    c.beginPath();
    c.arc(p[0], p[1], strokeWidth(s, p[2]) / 2, 0, Math.PI * 2);
    c.fill();
  }
  drawSegment(s, a, b, c) {
    this.prepare(s, c);
    c.lineWidth = strokeWidth(s, (a[2] + b[2]) / 2);
    c.beginPath();
    c.moveTo(a[0], a[1]);
    c.lineTo(b[0], b[1]);
    c.stroke();
  }
  composite(c, s) {
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation =
      s.tool === "eraser" ? "destination-out" : "source-over";
    c.globalAlpha = s.tool === "eraser" ? 1 : (s.opacity ?? 1);
    if (this.maskBounds) {
      const [x, y, width, height] = this.maskBounds;
      c.drawImage(this.mask, x, y, width, height, x, y, width, height);
    } else c.drawImage(this.mask, 0, 0);
    c.globalAlpha = 1;
    c.globalCompositeOperation = "source-over";
  }
  present() {
    this.clearCanvas(this.canvas);
    this.ctx.globalCompositeOperation = "source-over";
    this.ctx.globalAlpha = 1;
    this.ctx.drawImage(this.committed, 0, 0);
    if (this.active) this.composite(this.ctx, this.active.stroke);
  }
  scheduleRender() {
    if (this.renderFrame) return;
    this.renderFrame = requestAnimationFrame(() => {
      this.renderFrame = null;
      this.render();
    });
  }
  render() {
    if (!this.ctx) return;
    this.pending = [];
    this.clearCanvas(this.committed);
    for (const s of this.strokes) {
      if (s.brushVersion !== 2 && s.opacity === undefined) {
        const c = this.committed.getContext("2d");
        this.drawDot(s, s.points[0], c);
        for (let i = 1; i < s.points.length; i++)
          this.drawSegment(s, s.points[i - 1], s.points[i], c);
        continue;
      }
      this.clearCanvas(this.mask);
      const [sx, sy] = this.mode === "document" ? [scrollX, scrollY] : [0, 0];
      let left = Infinity,
        top = Infinity,
        right = -Infinity,
        bottom = -Infinity;
      for (const [x, y] of s.points) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
      const pad = s.width / 2 + 2;
      const x = Math.max(0, Math.floor((left - pad - sx) * this.dpr));
      const y = Math.max(0, Math.floor((top - pad - sy) * this.dpr));
      const width =
        Math.min(this.mask.width, Math.ceil((right + pad - sx) * this.dpr)) - x;
      const height =
        Math.min(this.mask.height, Math.ceil((bottom + pad - sy) * this.dpr)) -
        y;
      if (width <= 0 || height <= 0) continue;
      this.maskBounds =
        s === this.active?.stroke ? null : [x, y, width, height];
      const c = this.mask.getContext("2d");
      this.drawDot(s, s.points[0], c);
      for (let i = 1; i < s.points.length; i++)
        this.drawSegment(s, s.points[i - 1], s.points[i], c);
      if (s !== this.active?.stroke)
        this.composite(this.committed.getContext("2d"), s);
    }
    this.present();
  }
  export() {
    return {
      format: "portable-canvas",
      version: 1,
      key: this.key,
      mode: this.mode,
      strokes: structuredClone(this.strokes),
    };
  }
  import(data) {
    if (this.loading)
      throw new Error("Wait for the current page to finish opening.");
    const strokes = validateDrawing(data);
    this.finish();
    this.strokes = strokes;
    this.pointCount = strokes.reduce((n, s) => n + s.points.length, 0);
    this.redoStack = [];
    this.changed();
    this.render();
    return this.save();
  }
  async destroy() {
    if (this.loading) return false;
    this.finish();
    this.loading = true;
    const saved = await this.save();
    if (!saved) {
      this.loading = false;
      return false;
    }
    clearInterval(this.interval);
    clearTimeout(this.debounce);
    cancelAnimationFrame(this.frame);
    cancelAnimationFrame(this.renderFrame);
    this.abort.abort();
    this.host.remove();
    this.store.close();
    return true;
  }
}
