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
      !["pen", "fountain", "highlighter", "eraser"].includes(s.tool) ||
      !/^#[0-9a-f]{6}$/i.test(s.color) ||
      !Number.isFinite(s.width) ||
      s.width < 1 ||
      s.width > 100 ||
      !Array.isArray(s.points) ||
      !s.points.length
    )
      throw new Error("Invalid stroke.");
    for (const field of ["opacity", "sensitivity"]) {
      if (
        field in s &&
        (!Number.isFinite(s[field]) || s[field] < 0 || s[field] > 1)
      )
        throw new Error(`Invalid stroke ${field}.`);
    }
    if ("brushVersion" in s && s.brushVersion !== 2)
      throw new Error("Invalid brush version.");
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
    return {
      tool: s.tool,
      color: s.color,
      width: s.width,
      points,
      ...Object.fromEntries(
        ["opacity", "sensitivity", "brushVersion"]
          .filter((k) => k in s)
          .map((k) => [k, s[k]]),
      ),
    };
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
  const result = {
    color:
      typeof s.color === "string" && /^#[0-9a-f]{6}$/i.test(s.color)
        ? s.color
        : DEFAULTS.color,
    width:
      Number.isFinite(s.width) && s.width >= 1 && s.width <= 64
        ? s.width
        : DEFAULTS.width,
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
  if (s.tools && typeof s.tools === "object") {
    result.tools = toolSettings(s.tools, result);
  }
  return result;
}

export const TOOLS = ["pen", "fountain", "highlighter", "eraser"];
export function toolSettings(value = {}, legacy = DEFAULTS) {
  return Object.fromEntries(
    TOOLS.map((tool) => {
      const defaults = {
        color: tool === "highlighter" ? "#fff000" : legacy.color,
        width:
          tool === "highlighter" ? 24 : tool === "eraser" ? 24 : legacy.width,
        opacity: tool === "highlighter" ? 0.35 : 1,
        sensitivity: 0.5,
      };
      const v = value?.[tool] || {};
      const bounded = (key, min, max) =>
        Number.isFinite(v[key]) && v[key] >= min && v[key] <= max
          ? v[key]
          : defaults[key];
      return [
        tool,
        {
          color: /^#[0-9a-f]{6}$/i.test(v.color) ? v.color : defaults.color,
          width: bounded("width", 1, tool === "eraser" ? 100 : 64),
          opacity: bounded("opacity", 0, 1),
          sensitivity: bounded("sensitivity", 0, 1),
        },
      ];
    }),
  );
}
// Missing brushVersion preserves the original pressure curve of version-1 drawings.
export function strokeWidth(stroke, pressure) {
  if (stroke.brushVersion !== 2) return stroke.width * (0.35 + pressure * 0.65);
  if (stroke.tool === "fountain")
    return (
      stroke.width * (1 - (stroke.sensitivity ?? 0.5) * (1 - pressure) * 0.9)
    );
  return stroke.width;
}
