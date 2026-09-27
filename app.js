import { mount } from "./src/widget.js";
import { safeAddress } from "./src/model.js";
const $ = (s) => document.querySelector(s),
  notice = (text) => ($("#notice").textContent = text);
const canvas = mount({
  key: "demo:reading",
  onStatus: (status) => {
    if (status === "Saved locally") recents();
  },
});
window.portableCanvas = canvas;
let current = "reading",
  webURL = "https://example.com/";
async function recents() {
  try {
    const rows = (await canvas.store.recents()).filter(
      (row) =>
        row.key === "demo:reading" ||
        row.key === "demo:blank" ||
        row.key.startsWith("web:"),
    );
    const box = $("#recents");
    box.replaceChildren();
    for (const row of rows) {
      const b = document.createElement("button");
      b.textContent = row.key.replace("demo:", "").replace("web:", "");
      b.title = row.key;
      b.onclick = () =>
        row.key.startsWith("web:")
          ? navigateWeb(row.key.slice(4))
          : selectPage(row.key.replace("demo:", ""));
      box.append(b);
    }
    if (!rows.length) box.textContent = "Your pages will appear here.";
  } catch (e) {
    notice(e.message);
  }
}
async function selectPage(page) {
  if (!["reading", "blank", "web"].includes(page)) return;
  const key = page === "web" ? `web:${webURL}` : `demo:${page}`;
  if (!(await canvas.setPage(key))) {
    notice(
      "Page switch stopped so your unsaved drawing stays available. Export it, then retry saving.",
    );
    return;
  }
  canvas.toggle(false);
  canvas.mode = page === "web" ? "viewport" : "document";
  current = page;
  for (const id of ["reading", "blank", "web"])
    $("#" + id).hidden = id !== page;
  document
    .querySelectorAll("[data-page]")
    .forEach((b) => b.classList.toggle("active", b.dataset.page === page));
  $("#sidebar").classList.remove("open");
  $("#menu").setAttribute("aria-expanded", "false");
  window.scrollTo(0, 0);
  canvas.render();
  notice("");
  await recents();
}
async function navigateWeb(raw) {
  try {
    const url = safeAddress(raw);
    const previous = webURL;
    webURL = url;
    await selectPage("web");
    if (canvas.key !== `web:${url}`) {
      webURL = previous;
      return;
    }
    $("#url").value = url;
    $("#original").href = url;
    $("iframe").src = url;
  } catch (e) {
    notice(e.message);
  }
}
for (const b of document.querySelectorAll("[data-page]"))
  b.onclick = () =>
    b.dataset.page === "web" ? navigateWeb(webURL) : selectPage(b.dataset.page);
$("#menu").onclick = () => {
  $("#sidebar").classList.toggle("open");
  $("#menu").setAttribute(
    "aria-expanded",
    String($("#sidebar").classList.contains("open")),
  );
};
$("#address").onsubmit = (e) => {
  e.preventDefault();
  navigateWeb($("#url").value);
};
$("#export").onclick = () => {
  const blob = new Blob([JSON.stringify(canvas.export())], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "portable-canvas-drawing.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$("#import").onchange = async (e) => {
  try {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) throw new Error("Backup exceeds 50 MB.");
    if (
      canvas.strokes.length &&
      !confirm(
        "Replace this drawing with the imported drawing? Export first if you want to keep it.",
      )
    )
      return;
    const ok = await canvas.import(JSON.parse(await file.text()));
    notice(
      ok
        ? "Drawing imported and saved."
        : "Imported drawing is in memory but could not be saved. Export before leaving.",
    );
    await recents();
  } catch (err) {
    notice(`Import failed: ${err.message}`);
  } finally {
    e.target.value = "";
  }
};
$("#clear").onclick = () => {
  if (
    confirm("Clear this drawing? This cannot be undone. Other pages will stay.")
  )
    canvas.clear();
};
$("#settings").onclick = () => {
  try {
    canvas.setRetention(
      Number($("#maxPages").value),
      Number($("#budget").value) * 1024 * 1024,
    );
    notice("Limits updated. They apply on the next changed drawing save.");
  } catch (e) {
    notice(e.message);
  }
};
$("#maxPages").value = canvas.settings.maxPages;
$("#budget").value = canvas.settings.maxBytes / 1024 / 1024;
await canvas.ready;
await recents();
