/**
 * Revert cap-surge — restore StickerRegistry.ts and CanvasPainter.ts from backups.
 */
import fs from 'fs';
import path from 'path';

const root = process.cwd();
for (const rel of ['src/features/editor/StickerRegistry.ts', 'src/features/editor/CanvasPainter.ts']) {
    const file = path.join(root, rel);
    const bak = file + '.surge-backup';
    if (fs.existsSync(bak)) {
        fs.copyFileSync(bak, file);
        fs.unlinkSync(bak);
        console.log('restored', rel);
    } else {
        console.log('no backup', rel);
    }
}
console.log('Next: pnpm run sync:stickers && pnpm run test:unit');
