import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = import.meta.dirname;
const dist = join(root, 'dist');
const output = join(root, 'neon-rooftop-jump-offline.html');

const html = readFileSync(join(dist, 'index.html'), 'utf8');
const css = readFileSync(join(dist, 'styles.css'), 'utf8');
const core = readFileSync(join(dist, 'game-core.js'), 'utf8').replaceAll('export ', '');
const meta = readFileSync(join(dist, 'meta-systems.js'), 'utf8').replaceAll('export ', '');
const game = readFileSync(join(dist, 'game.js'), 'utf8')
  .replace(/^import\s*\{[\s\S]*?\}\s*from\s*['"]\.\/game-core\.js['"];\s*/, '')
  .replace(/^import\s*\{[\s\S]*?\}\s*from\s*['"]\.\/meta-systems\.js['"];\s*/, '');

const bundled = html
  .replace('<link rel="stylesheet" href="./styles.css" />', `<style>\n${css}\n</style>`)
  .replace('<script type="module" src="./game.js"></script>', `<script type="module">\n${core}\n${meta}\n${game}\n</script>`)
  .replace('<title>霓虹跃迁｜像素屋顶跳跃</title>', '<title>霓虹跃迁｜离线版</title>');

writeFileSync(output, bundled, 'utf8');
console.log(output);
