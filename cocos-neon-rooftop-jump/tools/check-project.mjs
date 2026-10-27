import { readFile, readdir } from 'node:fs/promises';
import { extname, join } from 'node:path';

const root = new URL('../', import.meta.url);
const required = [
  'package.json',
  'tsconfig.json',
  'settings/v2/packages/project.json',
  'assets/scenes/main.scene',
  'assets/scenes/main.scene.meta',
  'assets/scripts/NeonJumpGame.ts',
  'assets/scripts/NeonJumpGame.ts.meta',
  'assets/scripts/core/GameMath.ts',
  'assets/scripts/core/MetaSystems.ts',
];

for (const relative of required) await readFile(new URL(relative, root));

async function checkJsonDirectory(relative) {
  const directory = new URL(relative, root);
  for (const name of await readdir(directory)) {
    if (!['.json', '.meta', '.scene'].includes(extname(name))) continue;
    const text = await readFile(new URL(join(relative, name), root), 'utf8');
    JSON.parse(text);
  }
}

await checkJsonDirectory('assets/scenes/');
await checkJsonDirectory('assets/scripts/');
await checkJsonDirectory('assets/scripts/core/');
await checkJsonDirectory('settings/v2/packages/');

const scene = JSON.parse(await readFile(new URL('assets/scenes/main.scene', root), 'utf8'));
if (!scene.some((item) => item.__type__ === '4d6b2ocn0JOaqXDKKLFsUWY')) {
  throw new Error('main.scene is not wired to NeonJumpGame');
}
console.log('Cocos project structure OK');
