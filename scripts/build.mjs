import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const required = ['index.html', 'demo.html', 'logo.svg', 'favicon.svg', 'landing.css', 'app.js', 'style.css', 'src'];
for (const name of required) {
  if (!existsSync(join(root, name))) throw new Error(`Missing site asset: ${name}`);
}
rmSync(dist, {recursive:true, force:true});
mkdirSync(dist, {recursive:true});
for (const name of [...required, 'landing.js', 'assets', 'examples']) {
  if (existsSync(join(root, name))) cpSync(join(root, name), join(dist, name), {recursive:true});
}
console.log('Built public landing, demo and embeddable widget into dist/.');
