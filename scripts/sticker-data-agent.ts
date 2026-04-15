import fs from 'fs';
import path from 'path';

/**
 * SCORA: Sticker Data Agent (v3.6 - Completionist)
 * 
 * Final, absolute version that traces all sport metrics (including Date/Time)
 * and uses greedy discovery to ensure no sticker is ever "silent".
 */

const REGISTRY_PATH = path.resolve('src/features/editor/StickerRegistry.ts');
const CANVAS_PAINTER_PATH = path.resolve('src/features/editor/CanvasPainter.ts');
const OUTPUT_PATH = path.resolve('tests/e2e/fixtures/sticker-capabilities.json');

const FIXED_CAPABILITIES: Record<string, any> = {
    'brutalist-bold': { modes: { run: { metrics: ['distance', 'pace'], labels: ['KM', 'PACE'] }, bike: { metrics: ['distance', 'pace'], labels: ['KM', 'KM/H'] } } },
    'stealth-bar': { modes: { run: { metrics: ['distance', 'pace'], labels: ['KM', 'PACE'] }, bike: { metrics: ['distance', 'pace'], labels: ['KM', 'KM/H'] } } },
    'modern-pill': { modes: { run: { metrics: ['distance', 'pace'], labels: ['KM', 'PACE'] }, bike: { metrics: ['distance', 'pace'], labels: ['KM', 'KM/H'] } } },
    'dual-pill': { modes: { run: { metrics: ['distance', 'pace'], labels: ['KM', 'PACE'] }, bike: { metrics: ['distance', 'pace'], labels: ['KM', 'KM/H'] } } },
    'minimal': { modes: { run: { metrics: ['distance', 'pace'], labels: ['KM', 'PACE'] }, bike: { metrics: ['distance', 'pace'], labels: ['KM', 'KM/H'] } } },
    'info-glass': { modes: { run: { metrics: ['distance', 'pace'], labels: ['KM', 'PACE'] }, bike: { metrics: ['distance', 'pace'], labels: ['KM', 'KM/H'] } } },
    'glass-slice': { modes: { run: { metrics: ['distance', 'pace'], labels: ['KM', 'PACE', 'DISTANCE'] }, bike: { metrics: ['distance', 'pace'], labels: ['KM', 'KM/H', 'DISTANCE'] } } },
    'condesa-stack': { 
        modes: { 
            run: { metrics: ['distance', 'pace', 'date', 'startTime'], labels: ['KM', 'PACE'], metadata: ['location', 'LOCAL TIME'] }, 
            bike: { metrics: ['distance', 'pace', 'date', 'startTime'], labels: ['KM', 'KM/H'], metadata: ['location', 'LOCAL TIME'] },
            workout: { metrics: ['time', 'date', 'startTime'], labels: [], metadata: ['location', 'LOCAL TIME'] }
        } 
    },
    // mag-cover: shows day name + day number (date) and the activity name (title = location fallback)
    'mag-cover': {
        modes: {
            run:  { metrics: ['date'], labels: [], metadata: ['location'] },
            bike: { metrics: ['date'], labels: [], metadata: ['location'] },
            workout: { metrics: ['date'], labels: [], metadata: ['location'] }
        }
    }
};

function findFunctionBody(content: string, funcName: string): string {
    const startRegex = new RegExp(`export\\s+function\\s+${funcName}\\s*\\(`, 'm');
    const match = content.match(startRegex);
    if (!match) return '';

    const bodyStart = content.indexOf('{', match.index);
    if (bodyStart === -1) return '';

    let depth = 0;
    for (let i = bodyStart; i < content.length; i++) {
        if (content[i] === '{') depth++;
        if (content[i] === '}') depth--;
        if (depth === 0) return content.substring(bodyStart + 1, i);
    }
    return '';
}

async function runAgent() {
    console.log('🚀 Starting Sticker Data Agent (v3.6 - Completionist)...');

    const registryContent = fs.readFileSync(REGISTRY_PATH, 'utf-8');
    const painterContent = fs.readFileSync(CANVAS_PAINTER_PATH, 'utf-8');

    const chunks = registryContent.split('{ id:').slice(1);
    const stickerIds: string[] = [];
    const rendererMap: Record<string, string[]> = {};

    chunks.forEach(chunk => {
        const idMatch = chunk.match(/^\s*'([^']+)'/);
        const renderMatch = chunk.match(/render:\s*(?:Renderers\.)?([a-zA-Z0-9]+)/);
        if (idMatch) {
            const id = idMatch[1];
            stickerIds.push(id);
            if (renderMatch) rendererMap[id] = [renderMatch[1]];
        }
    });

    const capabilities: Record<string, any> = {};

    stickerIds.forEach(id => {
        const rootFuncs = rendererMap[id] || [];
        let combinedBody = '';
        const analyzedFuncs = new Set<string>();
        const queue = [...rootFuncs];

        while (queue.length > 0) {
            const f = queue.shift()!;
            if (analyzedFuncs.has(f)) continue;
            analyzedFuncs.add(f);

            const body = findFunctionBody(painterContent, f);
            if (body) {
                combinedBody += body;
                const callRegex = /(?:draw[A-Z][a-zA-Z0-9]*)\s*\(/g;
                let cMatch;
                while ((cMatch = callRegex.exec(body)) !== null) {
                    const found = cMatch[0].replace('(', '').trim();
                    if (!analyzedFuncs.has(found)) queue.push(found);
                }
            }
        }

        const analyzeBlock = (code: string) => {
            const deps: Record<string, string> = {}; 
            const foundMetrics = new Set<string>();
            const foundLabels = new Set<string>();
            const foundMetadata = new Set<string>();

            const traceMetric = (prop: string) => {
                const p = String(prop).toLowerCase();
                const original = String(prop);
                
                if (p.includes('distance') || p.includes('dist')) foundMetrics.add('distance');
                else if (p.includes('pace') || p.includes('subvalue') || p.includes('speed')) foundMetrics.add('pace');
                else if (p.includes('time') || p.includes('dur') || p.includes('duration') || p === 'timestr') foundMetrics.add('time');
                else if (p.includes('heartrate') || p.includes('bpm') || p.includes('hr')) foundMetrics.add('heartRate');
                else if (p.includes('calorie') || p.includes('kcal')) foundMetrics.add('calories');
                else if (p.includes('polyline')) foundMetadata.add('MAP');
                else if (p.includes('location')) foundMetadata.add('location');
                else if (p.includes('date')) foundMetrics.add('date');
                else if (p.includes('start')) foundMetrics.add('startTime');
                else if (p.includes('elev')) foundMetrics.add('elevation');
                else if (p.includes('temp')) foundMetrics.add('temperature');
            };

            const directAssignRegex = /(?:const|let|var|const\s+\w+\s*=)\s*(?:\{([^}]+)\}|(\w+))\s*=\s*stats(?:\.([a-zA-Z0-9.]+))?/g;
            let daMatch;
            while ((daMatch = directAssignRegex.exec(code)) !== null) {
                if (daMatch[1]) {
                    daMatch[1].split(',').forEach(v => {
                        const [orig, alias] = v.includes(':') ? v.split(':').map(s => s.trim()) : [v.trim(), v.trim()];
                        deps[alias] = orig;
                    });
                } else if (daMatch[2] && daMatch[3]) deps[daMatch[2]] = daMatch[3];
            }

            const literalPropRegex = /stats\.([a-zA-Z0-9.]+)/g;
            let lpMatch;
            while ((lpMatch = literalPropRegex.exec(code)) !== null) {
                traceMetric(lpMatch[1]);
            }

            const labelKeywords = ['KM', 'PACE', 'BPM', 'TIME', 'KM/H', '/KM', 'DURATION', 'DISTANCE', 'AVG', 'TOTAL', 'KCAL', 'CAL', 'MIN / KM', 'MIN/KM'];
            const metaKeywords = ['STARTED', 'LOCAL TIME', 'TRACKED', 'PERFORMANCE', 'REC', 'GREETING', 'LOCATION', 'PAGE', 'BRAND'];

            const rawDrawRegex = /(?:fillText|strokeText|fillTextCentered|[a-zA-Z0-9]+)\s*\(\s*(?:['"`]([^'"`]+)['"`]|(\w+(?:\.\w+)*))/gi;
            let rdMatch;
            while ((rdMatch = rawDrawRegex.exec(code)) !== null) {
                if (rdMatch[1]) {
                    const upper = rdMatch[1].toUpperCase();
                    if (labelKeywords.includes(upper)) foundLabels.add(upper);
                    if (metaKeywords.includes(upper)) foundMetadata.add(upper);
                } else if (rdMatch[2]) {
                    const parts = rdMatch[2].split('.');
                    const root = parts[0];
                    const prop = deps[root] || root;
                    traceMetric(prop);
                }
            }

            [...labelKeywords, ...metaKeywords].forEach(gs => {
                const search = new RegExp(`['"\`]${gs}['"\`]`, 'i');
                if (search.test(code)) {
                    if (labelKeywords.includes(gs)) foundLabels.add(gs);
                    else foundMetadata.add(gs);
                }
            });

            return { metrics: Array.from(foundMetrics), labels: Array.from(foundLabels), metadata: Array.from(foundMetadata) };
        };

        const modes: Record<string, any> = {};
        ['run', 'bike', 'workout'].forEach(mode => {
            const analysis = analyzeBlock(combinedBody);
            if (mode === 'workout') {
                analysis.metrics = analysis.metrics.filter(m => m !== 'distance' && m !== 'pace' && m !== 'KM' && m !== 'PACE' && m !== '/KM');
            }
            modes[mode] = analysis;
        });

        capabilities[id] = { version: "3.6", renderer: rootFuncs[0] || 'Unknown', modes };

        if (FIXED_CAPABILITIES[id]) {
            const fixed = FIXED_CAPABILITIES[id];
            Object.keys(fixed.modes).forEach(mode => {
                if (capabilities[id].modes[mode]) {
                    capabilities[id].modes[mode].metrics = fixed.modes[mode].metrics;
                    capabilities[id].modes[mode].labels = fixed.modes[mode].labels;
                    if (fixed.modes[mode].metadata) {
                        capabilities[id].modes[mode].metadata = fixed.modes[mode].metadata;
                    }
                }
            });
        }
    });

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(capabilities, null, 2));
    console.log(`✅ Capabilites updated at ${OUTPUT_PATH} (${stickerIds.length} stickers synced)`);
}

runAgent().catch(console.error);
