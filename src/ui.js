const icon = (path) =>
  `<svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
export const icons = {
  pen: icon('<path d="m16 3 5 5-12 12-6 1 1-6Z M13 6l5 5 M4 16l4 4"/>'),
  fountain: icon(
    '<path d="m12 2 7 13-3 6H8l-3-6Z M12 3v9 M8 21h8"/><circle cx="12" cy="14" r="2"/>',
  ),
  highlighter: icon('<path d="M8 3h8v7l3 5v6H5v-6l3-5Z M8 10h8 M5 17h14"/>'),
  eraser: icon('<path d="m14 3 7 7-10 11H6l-4-4Z M7 12l7 7 M11 21h11"/>'),
  undo: icon('<path d="m8 5-5 5 5 5 M3 10h11a5 5 0 0 1 0 10h-4"/>'),
  redo: icon('<path d="m16 5 5 5-5 5 M21 10H10a5 5 0 0 0 0 10h4"/>'),
  save: icon('<path d="M5 3h12l4 4v14H3V3Z M7 3v6h10V3 M7 21v-8h10v8"/>'),
  input: icon('<path d="m14 3 5 5-9 9-5 1 1-5Z M3 21h18"/>'),
  close: icon('<path d="m6 6 12 12 M18 6 6 18"/>'),
};
export const labels = {
  pen: "펜",
  fountain: "만년필",
  highlighter: "형광펜",
  eraser: "지우개",
};
const names = {
  pen: "Pen",
  fountain: "Fountain pen",
  highlighter: "Highlighter",
  eraser: "Eraser",
  undo: "Undo",
  redo: "Redo",
  save: "Save now",
  input: "Pen only",
  close: "Close drawing",
};
export const palette = [
  "#000000",
  "#0066ff",
  "#ff1717",
  "#fff000",
  "#91ef00",
  "#5731ef",
];
export function markup() {
  return `<style>
:host{font:14px system-ui,sans-serif;color:#171c1d}*{box-sizing:border-box}canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}button,input{font:inherit;color:inherit}button{border:0;background:transparent;cursor:pointer;min-width:44px;min-height:44px;display:inline-flex;align-items:center;justify-content:center;padding:0;flex-shrink:0}button:hover{background:#f2f6f5}button:focus-visible,input:focus-visible{outline:2px solid #226ad6;outline-offset:-2px}button[aria-pressed=true]::after{content:"";position:absolute;bottom:3px;left:12px;right:12px;height:3px;border-radius:2px;background:#f5df00}.controls button{position:relative}.controls{position:absolute;bottom:calc(16px + env(safe-area-inset-bottom,0px));left:50%;transform:translateX(-50%);display:flex;flex-wrap:nowrap;overflow-x:auto;max-width:calc(100% - 16px);padding:3px 5px;background:#fff;border:1px solid #e4eeee;border-radius:12px;box-shadow:0 3px 16px #57878c20;pointer-events:auto;scrollbar-width:thin}.controls button{width:44px}.controls [data-action=close]{position:sticky;right:0;background:white}.toggle{position:absolute;right:20px;bottom:calc(16px + env(safe-area-inset-bottom,0px));width:48px;height:48px;background:white;border:1px solid #e1e9e8;border-radius:50%;box-shadow:0 3px 15px #57878c24;pointer-events:auto}.panel{position:absolute;bottom:calc(78px + env(safe-area-inset-bottom,0px));left:50%;transform:translateX(-50%);width:344px;max-width:calc(100% - 24px);max-height:calc(100dvh - 94px - env(safe-area-inset-bottom,0px));overflow:auto;overscroll-behavior:contain;padding:10px 16px 12px;background:white;border:1px solid #e4eeee;border-radius:17px;box-shadow:0 5px 24px #4a858d26;pointer-events:auto}.panel header{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}.panel h2{font-size:16px;margin:0}.panel header button{margin-right:-10px}.setting{margin:4px 0 12px}.setting label{display:flex;justify-content:space-between;font-size:12px}.setting input{display:block;width:100%;height:36px;margin:0;cursor:pointer;appearance:none;background:transparent}.setting input::-webkit-slider-runnable-track{height:4px;border-radius:8px;background:linear-gradient(to right,#ffe900 var(--fill),#e5eeee var(--fill))}.setting input::-webkit-slider-thumb{appearance:none;width:19px;height:19px;border-radius:50%;background:#ffe900;margin-top:-7.5px}.setting input::-moz-range-track{height:4px;background:#e5eeee}.setting input::-moz-range-progress{height:4px;background:#ffe900}.setting input::-moz-range-thumb{border:0;background:#ffe900;width:19px;height:19px;border-radius:50%}.setting.opacity input::-webkit-slider-runnable-track{height:18px;background:linear-gradient(to right,transparent,#172125),repeating-conic-gradient(#9cacaf 0% 25%,white 0% 50%) 0/8px 8px}.setting.opacity input::-webkit-slider-thumb{margin-top:0;background:#111;border:2px solid white;box-shadow:0 0 0 1px #516061}.colors-label{font-size:12px}.palette{display:flex;justify-content:space-between;margin:0 -10px;overflow-x:auto}.swatch{width:44px;min-width:44px;position:relative}.swatch span{width:21px;height:21px;border-radius:50%;background:var(--color)}.swatch[aria-pressed=true] span{outline:1.5px solid var(--color);outline-offset:3px}.swatch[aria-pressed=true]::after{display:none}.custom{position:relative;width:44px;min-width:44px;height:44px;display:flex;align-items:center;justify-content:center}.custom span{border-radius:50%;width:24px;height:24px;background:conic-gradient(red,yellow,lime,cyan,blue,magenta,red);display:grid;place-items:center}.custom span::after{content:"+";background:white;border-radius:50%;width:17px;height:17px;text-align:center;font-size:15px;line-height:16px}.custom input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer}.status{position:absolute;top:12px;left:50%;transform:translateX(-50%);max-width:calc(100% - 24px);padding:8px 13px;border-radius:9px;background:#fffffff2;text-align:center;pointer-events:none}[hidden]{display:none!important}@media(max-width:700px){.status{top:calc(80px + env(safe-area-inset-top,0px))}.controls button{width:44px}.controls [data-action=close]{position:sticky;right:0;background:white}.controls{left:8px;transform:none;width:calc(100% - 16px)}.panel{width:344px}}@media(max-height:450px){.status{top:8px}.panel header{margin-bottom:0}.setting{margin-bottom:0}}
</style><canvas aria-label="Drawing surface"></canvas><div class="status" role="status" aria-live="polite">Opening local storage…</div><section class="panel" aria-label="Tool settings" hidden><header><h2>펜</h2><button data-action="close-panel" aria-label="Close settings">${icons.close}</button></header><div class="setting"><label for="width">두께 <output id="width-value"></output></label><input id="width" type="range" min="1" max="64" step="1" aria-label="Stroke width"></div><div class="setting sensitivity" hidden><label for="sensitivity">압력 민감도 <output id="sensitivity-value"></output></label><input id="sensitivity" type="range" min="0" max="100" aria-label="Pressure sensitivity"></div><div class="setting opacity"><label for="opacity">불투명도 <output id="opacity-value"></output></label><input id="opacity" type="range" min="0" max="100" aria-label="Opacity"></div><div class="colors"><div class="colors-label">색상</div><div class="palette">${palette.map((color, i) => `<button class="swatch" data-color="${color}" aria-label="${["Black", "Blue", "Red", "Yellow", "Lime", "Purple"][i]} ink" aria-pressed="false" style="--color:${color}"><span></span></button>`).join("")}<label class="custom"><span></span><input type="color" aria-label="Ink color"></label></div></div><button data-action="input" aria-label="Pen only" aria-pressed="false" title="Pen only">${icons.input}<span>펜 입력만</span></button></section><div class="controls" role="toolbar" aria-label="Drawing tools" hidden>${["undo", "redo", "pen", "fountain", "highlighter", "eraser", "save", "close"].map((action) => `<button data-action="${action}" aria-label="${names[action]}" title="${names[action]}" ${["pen", "fountain", "highlighter", "eraser", "input"].includes(action) ? 'aria-pressed="false"' : ""}>${icons[action]}</button>`).join("")}</div><button class="toggle" aria-label="Toggle drawing" aria-pressed="false">${icons.pen}</button>`;
}
