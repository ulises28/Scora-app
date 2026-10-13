/**
 * Complexity metrics for sticker implementations (anti-overcode).
 * Usage: npx tsx evals/runners/check-sticker-complexity.ts [functionName]
 */
import fs from 'fs';

const painter = fs.readFileSync('src/features/editor/CanvasPainter.ts', 'utf-8');
const registry = fs.readFileSync('src/features/editor/StickerRegistry.ts', 'utf-8');

function fnLoc(name: string): number {
    const re = new RegExp(`export function ${name}\\s*\\(`);
    const m = painter.match(re);
    if (!m || m.index == null) return -1;
    const start = painter.indexOf('{', m.index);
    let depth = 0;
    for (let i = start; i < painter.length; i++) {
        if (painter[i] === '{') depth++;
        else if (painter[i] === '}') {
            depth--;
            if (depth === 0) return painter.slice(m.index, i).split('\n').length;
        }
    }
    return -1;
}

const ids = [...registry.matchAll(/id: '([^']+)'/g)].map(m => m[1]);
const target = process.argv[2];

if (target) {
    const loc = fnLoc(target.startsWith('draw') ? target : `draw${target.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase())}`);
    console.log(`${target}: ${loc} LOC`);
    process.exit(loc < 0 ? 1 : loc > 120 ? 1 : 0);
}

console.log('Sticker renderer LOC (budget 120):');
let over = 0;
for (const id of ids) {
    // try common draw names from registry render: Renderers.drawX
    const m = registry.match(new RegExp(`id: '${id}'.*?render: Renderers\\.(\\w+)`, 's'));
    const fn = m?.[1];
    if (!fn) continue;
    const loc = fnLoc(fn);
    const flag = loc > 120 ? ' OVER' : loc < 0 ? ' ?' : '';
    if (loc > 120) over++;
    if (loc < 0 || loc > 80) console.log(`  ${fn}: ${loc}${flag}`);
}
console.log(`Over budget: ${over}`);
process.exit(over > 0 ? 1 : 0);
