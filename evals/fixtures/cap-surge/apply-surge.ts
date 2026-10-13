/**
 * Apply cap-surge: insert 12 fixture stickers into registry + painters.
 * Backs up originals as *.surge-backup. Pair with revert-surge.ts.
 */
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const regPath = path.join(root, 'src/features/editor/StickerRegistry.ts');
const paintPath = path.join(root, 'src/features/editor/CanvasPainter.ts');
const fixture = path.join(root, 'evals/fixtures/cap-surge');

function backup(file: string) {
    const bak = file + '.surge-backup';
    if (!fs.existsSync(bak)) fs.copyFileSync(file, bak);
}

backup(regPath);
backup(paintPath);

// 1) Registry: insert surge lines before the closing of ACTIVE_STICKER_LIST
let reg = fs.readFileSync(regPath, 'utf-8');
if (!reg.includes("id: 'summit-ridge'")) {
    const entryLines = fs.readFileSync(path.join(fixture, 'surge-registry.txt'), 'utf-8').trimEnd() + '\n';
    const marker = '];\n\n/**\n * The unified UI-facing list';
    const idx = reg.indexOf('];\n');
    if (idx < 0) throw new Error('cannot find ACTIVE_STICKER_LIST end');
    reg = reg.slice(0, idx) + entryLines + reg.slice(idx);
    fs.writeFileSync(regPath, reg);
    console.log('registry: +12 surge stickers');
} else {
    console.log('registry: surge already present');
}

// 2) Painters: append fixture renderers once
let paint = fs.readFileSync(paintPath, 'utf-8');
if (!paint.includes('SURGE-FIXTURE BEGIN')) {
    const renderers = fs.readFileSync(path.join(fixture, 'surge-renderers.ts'), 'utf-8');
    fs.writeFileSync(paintPath, paint.trimEnd() + '\n\n' + renderers);
    console.log('painter: +12 surge renderers');
} else {
    console.log('painter: surge already present');
}

console.log('Applied cap-surge. Next: pnpm run sync:stickers && pnpm run test:unit');
