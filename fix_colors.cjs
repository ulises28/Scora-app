const fs = require('fs');

const targetColors = new Set([
  'note-accent', 'studio-precision', 'graffiti-expo', 'graffiti-map', 
  'graffiti-brand', 'editorial-strip', 'journal-grid', 'finish-line', 
  'tiny-gps', 'pulse-row', 'thin-path', 'boxed-metric', 'condesa-stack', 
  'stacked-editorial', 'micro-serif', 'stealth-bar', 'vertical-label', 
  'bold-day', 'manifest-list'
]);

let content = fs.readFileSync('src/features/editor/StickerRegistry.ts', 'utf-8');

// First remove supportsCustomColor: true, from everywhere
content = content.replace(/supportsCustomColor:\s*true,\s*/g, '');

// Then add it back only for the target ones
const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/id:\s*'([^']+)'/);
    if (match && targetColors.has(match[1])) {
        // Insert supportsCustomColor: true after the id
        lines[i] = lines[i].replace(/(id:\s*'[^']+',\s*)/, '$1supportsCustomColor: true, ');
    }
}

fs.writeFileSync('src/features/editor/StickerRegistry.ts', lines.join('\n'));
console.log('StickerRegistry updated successfully.');
