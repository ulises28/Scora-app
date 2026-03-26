const fs = require('fs');

const path = 'src/features/editor/TemplateManager.ts';
let code = fs.readFileSync(path, 'utf8');

const order = [
  'location-pill', 'dm', 'tiny-gps', 'pulse-row', 'thin-path', 'step-master', 'dual-pill',
  'brutalist-letters', 'boxed-metric', 'mono-minimal', 'split-badge', 'stacked-editorial',
  'micro-serif', 'vhs-retro'
];

// Quick and dirty parser that splits by `{` and `}` for the array
const arrayStart = code.indexOf('export const TEMPLATE_REGISTRY: readonly TemplateConfig[] = [');
const arrayEndTrim = code.indexOf('];', arrayStart);
// Wait, there are nested braces because of `features: { distance: true }`!
// A simple regex might not work, let's use a simpler approach:
// We can parse the file line by line, detecting `{ id:` and taking the block up to `},`

const lines = code.split('\n');
const startLine = lines.findIndex(l => l.includes('export const TEMPLATE_REGISTRY'));
const endLine = lines.findIndex((l, i) => i > startLine && l.trim() === 'export function getAvailableTemplates');

const registryLines = lines.slice(startLine + 1, endLine);
const registryStr = registryLines.join('\n');

// Split the string into individual template object strings
// Since each ends with `},` or `}` at the root level, we can do a naive split by `    },` and `    }`
const blocks = [];
let braceCount = 0;
let currentBlock = "";

for (let i = 0; i < registryStr.length; i++) {
    const char = registryStr[i];
    currentBlock += char;
    if (char === '{') braceCount++;
    if (char === '}') braceCount--;
    
    // If we're back at 0 braces and there's a comma, the block is done
    if (braceCount === 0 && (char === ',' || registryStr.substr(i, 2) === '}\n' || registryStr.substr(i, 2) === '}\r')) {
        // gobble any trailing comma or whitespace
        while(registryStr[i+1] === ',' || registryStr[i+1] === ' ' || registryStr[i+1] === '\n' || registryStr[i+1] === '\r') {
            currentBlock += registryStr[i+1];
            i++;
        }
        
        let trimmed = currentBlock.trim();
        if (trimmed && trimmed.startsWith('{') && trimmed.includes('id:')) {
            blocks.push(trimmed);
        }
        currentBlock = "";
    }
}

// Now sort the blocks
const sortedBlocks = [];
const remainingBlocks = [];

// Push ordered ones
for (let id of order) {
    const blockIndex = blocks.findIndex(b => b.includes(`id: '${id}'`));
    if (blockIndex !== -1) {
        sortedBlocks.push(blocks[blockIndex]);
        blocks.splice(blockIndex, 1);
    }
}

// Push the rest
remainingBlocks.push(...blocks);

const newRegistryContent = 'export const TEMPLATE_REGISTRY: readonly TemplateConfig[] = [\n' + 
    sortedBlocks.map(b => b.endsWith(',') ? '    ' + b : '    ' + b + ',').join('\n') + '\n\n    // ── REST OF TEMPLATES ──\n' +
    remainingBlocks.map(b => b.endsWith(',') ? '    ' + b : '    ' + b + ',').join('\n') + '\n];\n\n';

code = lines.slice(0, startLine).join('\n') + '\n' + newRegistryContent + lines.slice(endLine).join('\n');

fs.writeFileSync(path, code);
console.log('Successfully reordered TemplateManager.ts');
