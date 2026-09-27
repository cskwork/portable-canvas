import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const existingSpace = Number(process.argv[2]);
const moduleURL = new URL("./browser-check.mjs", import.meta.url).href;
const penModuleURL = new URL("./pen-ui-check.mjs", import.meta.url).href;
const outputDirectory = fileURLToPath(new URL("../evidence/", import.meta.url));
const script = `
const task = await taskSpace(${existingSpace || JSON.stringify("Portable Canvas regression")});
console.log({ spaceId: task.spaceId });
const { runBrowserChecks } = await import(${JSON.stringify(moduleURL)});
await runBrowserChecks({ taskSpace, spaceId: task.spaceId, base: 'http://127.0.0.1:4173', outputDirectory: ${JSON.stringify(outputDirectory)} });
const { runPenUiChecks } = await import(${JSON.stringify(penModuleURL)});
await runPenUiChecks({ taskSpace, spaceId: task.spaceId, base: 'http://127.0.0.1:4173', outputDirectory: ${JSON.stringify(outputDirectory)} });
${existingSpace ? "" : "await task.finish({ keep: [] });"}
`;
const result = spawnSync("ego-browser", ["nodejs"], {
  input: script,
  stdio: ["pipe", "inherit", "inherit"],
});
if (result.error) {
  console.error(result.error.message);
  process.exitCode = 1;
} else process.exitCode = result.status ?? 1;
