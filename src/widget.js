import {
  DEFAULTS,
  pageKey,
  validateDrawing,
  validatedSettings,
} from "./model.js";
import { DrawingStore } from "./storage.js";
const pen =
  '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m15 4 5 5-11 11-6 1 1-6Z M13 6l5 5"/></svg>';
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
    this.root.innerHTML = `<style>:host{font:14px system-ui;color:#282b25}*{box-sizing:border-box}canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}.controls{position:absolute;bottom:24px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:5px;background:#fffdf7;border:1px solid #d9d6c9;padding:6px;border-radius:18px;box-shadow:0 5px 24px #23251d20;pointer-events:auto;max-width:calc(100vw - 24px);flex-wrap:wrap;justify-content:center}button,input,select{min-height:44px;border:0;border-radius:11px;background:#eeeee5;color:inherit;font:inherit}button{min-width:44px;padding:8px 12px;cursor:pointer}button:hover{background:#e0e3d3}button[aria-pressed=true]{background:#ad492d;color:white}button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #ad492d;outline-offset:2px}.toggle{position:absolute;right:24px;bottom:24px;pointer-events:auto;width:56px;height:56px;border-radius:50%;background:#ad492d;color:white;box-shadow:0 4px 16px #25272030}.status{position:absolute;top:12px;left:50%;transform:translateX(-50%);max-width:calc(100% - 24px);padding:8px 13px;border-radius:9px;background:#fffdf7eF;text-align:center}.controls[hidden],.status[hidden]{display:none}input[type=color]{width:44px;padding:6px}select{max-width:90px} @media(max-width:700px){.status{top:calc(80px + env(safe-area-inset-top,0px))}.controls{bottom:calc(88px + env(safe-area-inset-bottom,0px));width:max-content;max-width:calc(100vw - 24px - env(safe-area-inset-left,0px) - env(safe-area-inset-right,0px))}.toggle{right:calc(16px + env(safe-area-inset-right,0px));bottom:calc(16px + env(safe-area-inset-bottom,0px))}}</style><canvas aria-label="Drawing surface"></canvas><div class="status" role="status" aria-live="polite">Opening local storage…</div><div class="controls" role="toolbar" aria-label="Drawing tools" hidden><button data-action="pen" aria-label="Pen" aria-pressed="true">${pen}</button><button data-action="eraser" aria-label="Eraser" aria-pressed="false"><svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m14 3 7 7-10 11H6l-4-4Z M7 12l7 7 M11 21h11"/></svg></button><input type="color" aria-label="Ink color" value="${this.settings.color}"><select aria-label="Stroke width"><option value="2">Fine</option><option value="4">Medium</option><option value="8">Broad</option><option value="16">Bold</option></select><button data-action="undo" aria-label="Undo"><svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 5 4 10l5 5M4 10h10a6 6 0 0 1 0 12"/></svg></button><button data-action="redo" aria-label="Redo"><svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m15 5 5 5-5 5m5-5H10a6 6 0 0 0 0 12"/></svg></button><button data-action="save">Save now</button><button data-action="input" aria-pressed="${this.settings.input === "pen"}">Pen only</button></div><button class="toggle" aria-label="Toggle drawing" aria-pressed="false">${pen}</button>`;
    for (const control of this.root.querySelectorAll("[aria-label]")) {
      control.title = control.getAttribute("aria-label");
    }
    this.canvas = this.root.querySelector("canvas");
    this.ctx = this.canvas.getContext("2d");
    this.statusEl = this.root.querySelector(".status");
    this.toolbar = this.root.querySelector(".controls");
    this.abort = new AbortController();
    const listen = (el, event, fn, opts = {}) =>
      el.addEventListener(event, fn, { ...opts, signal: this.abort.signal });
    listen(this.root.querySelector(".toggle"), "click", () => this.toggle());
    for (const b of this.root.querySelectorAll("[data-action]"))
      listen(b, "click", () => {
        const action = b.dataset.action;
        if (["pen", "eraser"].includes(action)) {
          this.tool = action;
          for (const t of this.root.querySelectorAll(
            "[data-action=pen],[data-action=eraser]",
          ))
            t.setAttribute("aria-pressed", String(t.dataset.action === action));
        } else if (action === "input") {
          this.settings.input = this.settings.input === "pen" ? "all" : "pen";
          b.setAttribute("aria-pressed", String(this.settings.input === "pen"));
          this.persistSettings();
        } else this[action]();
      });
    listen(this.root.querySelector("input"), "input", (e) => {
      this.settings.color = e.target.value;
      this.persistSettings();
    });
    const width = this.root.querySelector("select");
    width.value = this.settings.width;
    listen(width, "change", () => {
      this.settings.width = Number(width.value);
      this.persistSettings();
    });
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
        this.toggle(false);
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
    if (!force) this.finish();
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
        color: this.settings.color,
        width: this.settings.width,
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
    this.drawDot(this.active.stroke, this.active.stroke.points[0]);
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
        for (const [s, a, b] of this.pending || []) this.drawSegment(s, a, b);
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
    this.active = null;
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
    this.canvas.width = Math.round(innerWidth * dpr);
    this.canvas.height = Math.round(innerHeight * dpr);
    this.render();
  }
  prepare(s) {
    const c = this.ctx;
    c.setTransform(
      this.dpr,
      0,
      0,
      this.dpr,
      this.mode === "document" ? -scrollX * this.dpr : 0,
      this.mode === "document" ? -scrollY * this.dpr : 0,
    );
    c.globalCompositeOperation =
      s.tool === "eraser" ? "destination-out" : "source-over";
    c.strokeStyle = s.color;
    c.fillStyle = s.color;
    c.lineCap = "round";
    c.lineJoin = "round";
  }
  drawDot(s, p) {
    this.prepare(s);
    this.ctx.beginPath();
    this.ctx.arc(
      p[0],
      p[1],
      (s.width * (0.35 + p[2] * 0.65)) / 2,
      0,
      Math.PI * 2,
    );
    this.ctx.fill();
  }
  drawSegment(s, a, b) {
    this.prepare(s);
    this.ctx.lineWidth = s.width * (0.35 + ((a[2] + b[2]) / 2) * 0.65);
    this.ctx.beginPath();
    this.ctx.moveTo(a[0], a[1]);
    this.ctx.lineTo(b[0], b[1]);
    this.ctx.stroke();
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
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (const s of this.strokes) {
      this.drawDot(s, s.points[0]);
      for (let i = 1; i < s.points.length; i++)
        this.drawSegment(s, s.points[i - 1], s.points[i]);
    }
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
