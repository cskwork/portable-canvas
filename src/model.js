export const DEFAULTS = {
  color: "#272923",
  width: 4,
  input: "all",
  maxPages: 50,
  maxBytes: 50 * 1024 * 1024,
};
export function pageKey(value = location.href) {
  const url = new URL(value);
  url.hash = "";
  return url.href;
}
export function safeAddress(value) {
  const url = new URL(value.includes("://") ? value : `https://${value}`);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error("Enter an HTTP or HTTPS address without credentials.");
  return url.href;
}
export function bytes(strokes) {
  return new TextEncoder().encode(JSON.stringify(strokes)).length;
}
export function validateDrawing(data) {
  if (
    !data ||
    data.format !== "portable-canvas" ||
    data.version !== 1 ||
    !Array.isArray(data.strokes) ||
    data.strokes.length > 20000
  )
    throw new Error("This is not a supported Portable Canvas backup.");
  let count = 0;
  const strokes = data.strokes.map((s) => {
    if (
      !s ||
      !["pen", "eraser"].includes(s.tool) ||
      !/^#[0-9a-f]{6}$/i.test(s.color) ||
      !Number.isFinite(s.width) ||
      s.width < 1 ||
      s.width > 100 ||
      !Array.isArray(s.points) ||
      !s.points.length
    )
      throw new Error("Invalid stroke.");
    const points = s.points.map((p) => {
      if (
        ++count > 1000000 ||
        !Array.isArray(p) ||
        p.length !== 3 ||
        !p.every(Number.isFinite) ||
        Math.abs(p[0]) > 1e7 ||
        Math.abs(p[1]) > 1e7 ||
        p[2] < 0 ||
        p[2] > 1
      )
        throw new Error("Invalid drawing points.");
      return [...p];
    });
    return { tool: s.tool, color: s.color, width: s.width, points };
  });
  if (bytes(strokes) > 50 * 1024 * 1024)
    throw new Error("Backup exceeds 50 MB.");
  return strokes;
}
export function retentionPlan(records, activeKey, activeBytes, settings) {
  if (activeBytes > settings.maxBytes)
    throw new Error(
      "This drawing exceeds the storage budget. Export it or raise the budget before saving.",
    );
  const others = records
    .filter((r) => r.key !== activeKey)
    .sort((a, b) => a.accessed - b.accessed);
  let size = others.reduce((n, r) => n + r.bytes, activeBytes),
    count = others.length + 1;
  const remove = [];
  for (const r of others) {
    if (size <= settings.maxBytes && count <= settings.maxPages) break;
    remove.push(r.key);
    size -= r.bytes;
    count--;
  }
  return remove;
}

export function validatedSettings(value) {
  const s = value && typeof value === "object" ? value : {};
  return {
    color:
      typeof s.color === "string" && /^#[0-9a-f]{6}$/i.test(s.color)
        ? s.color
        : DEFAULTS.color,
    width: [2, 4, 8, 16].includes(s.width) ? s.width : DEFAULTS.width,
    input: s.input === "pen" ? "pen" : "all",
    maxPages:
      Number.isInteger(s.maxPages) && s.maxPages >= 1 && s.maxPages <= 10000
        ? s.maxPages
        : DEFAULTS.maxPages,
    maxBytes:
      Number.isFinite(s.maxBytes) &&
      s.maxBytes >= 1024 &&
      s.maxBytes <= 1024 * 1024 * 1000
        ? s.maxBytes
        : DEFAULTS.maxBytes,
  };
}
