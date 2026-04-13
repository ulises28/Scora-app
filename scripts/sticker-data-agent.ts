import fs from 'fs';
import path from 'path';

/**
 * SCORA: Sticker Data Agent (v2.9 - Universal Stabilization)
 */

const TEMPLATE_MANAGER_PATH = path.resolve('src/features/editor/TemplateManager.ts');
const CANVAS_PAINTER_PATH = path.resolve('src/features/editor/CanvasPainter.ts');
const OUTPUT_PATH = path.resolve('tests/e2e/fixtures/sticker-capabilities.json');

// Permanent Truth for Minimalist/Graphic stickers that are hard to trace
const FIXED_CAPABILITIES: Record<string, any> = {
    'brutalist-bold': { modes: { run: { metrics: ['distance', 'pace'], labels: ['KM', 'PACE'] }, bike: { metrics: ['distance', 'pace'], labels: ['KM', 'KM/H'] } } },
    'stealth-bar': { modes: { run: { metrics: ['distance', 'pace'], labels: ['KM', 'PACE'] }, bike: { metrics: ['distance', 'pace'], labels: ['KM', 'KM/H'] } } },
    'modern-pill': { modes: { run: { metrics: ['distance', 'pace'], labels: ['KM', 'PACE'] }, bike: { metrics: ['distance', 'pace'], labels: ['KM', 'KM/H'] } } },
    'dual-pill': { modes: { run: { metrics: ['distance', 'pace'], labels: ['KM', 'PACE'] }, bike: { metrics: ['distance', 'pace'], labels: ['KM', 'KM/H'] } } },
    'minimal': { modes: { run: { metrics: ['distance', 'pace'], labels: ['KM', 'PACE'] }, bike: { metrics: ['distance', 'pace'], labels: ['KM', 'KM/H'] } } },
    'info-glass': { modes: { run: { metrics: ['distance', 'pace'], labels: ['KM', 'PACE'] }, bike: { metrics: ['distance', 'pace'], labels: ['KM', 'KM/H'] } } },
    'glass-slice': { modes: { run: { metrics: ['distance', 'pace'], labels: ['KM', 'PACE', 'DISTANCE'] }, bike: { metrics: ['distance', 'pace'], labels: ['KM', 'KM/H', 'DISTANCE'] } } }
};

async function runAgent() {
    console.log('🚀 Starting Sticker Data Agent (v2.9 - Universal stabilization)...');

    const registryContent = fs.readFileSync(TEMPLATE_MANAGER_PATH, 'utf-8');
    const painterContent = fs.readFileSync(CANVAS_PAINTER_PATH, 'utf-8');

    // 1. Identify all registered templates from TemplateManager
    const idRegex = /id:\s*'([^']+)'/g;
    const stickerIds: string[] = [];
    let idMatch;
    while ((idMatch = idRegex.exec(registryContent)) !== null) {
        if (!stickerIds.includes(idMatch[1])) {
            stickerIds.push(idMatch[1]);
        }
    }

    // 2. Map IDs to Renderer Functions from CanvasPainter's RENDERER_REGISTRY
    const rendererMap: Record<string, string[]> = {};
    const registryBlockRegex = /const RENDERER_REGISTRY: Record<[^>]+> = \{([\s\S]*?)\n\};/m;
    const registryBlockMatch = painterContent.match(registryBlockRegex);
    
    if (registryBlockMatch) {
      const registryBlock = registryBlockMatch[1];
      stickerIds.forEach(id => {
        const entryRegex = new RegExp(`['"]${id}['"]\\s*:\\s*(?:([a-zA-Z0-9]+)|\\{([\\s\\S]*?)\\}|\\([^)]*\\)\\s*=>\\s*([a-zA-Z0-9]+))`, 'm');
        const entryMatch = registryBlock.match(entryRegex);
        if (entryMatch) {
          if (entryMatch[1]) rendererMap[id] = [entryMatch[1]];
          else if (entryMatch[2]) {
            rendererMap[id] = [...entryMatch[2].matchAll(/:\s*([a-zA-Z0-9]+)/g)].map(m => m[1]);
          } else if (entryMatch[3]) rendererMap[id] = [entryMatch[3]];
        }
      });
    }

    const capabilities: Record<string, any> = {};

    stickerIds.forEach(id => {
        const funcs = rendererMap[id] || [];
        let combinedBody = '';
        funcs.forEach(f => {
            const funcRegex = new RegExp(`function ${f}\\([^{]*?\\) \\{([\\s\\S]*?)^\\}`, 'm');
            const bodyMatch = painterContent.match(funcRegex);
            if (bodyMatch) combinedBody += bodyMatch[1];
            else {
              const looseRegex = new RegExp(`function ${f}\\([^{]*?\\) \\{([\\s\\S]*?)\n\\}`, 'm');
              const looseMatch = painterContent.match(looseRegex);
              if (looseMatch) combinedBody += looseMatch[1];
            }
        });

        const analyzeBlock = (code: string) => {
            const deps: Record<string, string> = {}; 
            const foundMetrics = new Set<string>();
            const foundLabels = new Set<string>();
            const foundMetadata = new Set<string>();

            // Tracing Logic
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

            const dpRegex = /(?:const|let|var)\s+(\w+)\s*=\s*stats\.dataPoints(?:\?\.)?find\s*\([^)]+?label\s*===\s*['"]([^'"]+)['"]\)\s*(?:\?\.)?value/g;
            let dpMatch;
            while ((dpMatch = dpRegex.exec(code)) !== null) deps[dpMatch[1]] = dpMatch[2].toLowerCase();

            const traceMetric = (prop: string) => {
                const p = String(prop).toLowerCase();
                if (p.includes('distance') || p.includes('dist')) foundMetrics.add('distance');
                if (p.includes('pace') || p.includes('subvalue') || p.includes('speed')) foundMetrics.add('pace');
                if (p.includes('time') || p.includes('dur') || p.includes('duration') || p === 'timestr') foundMetrics.add('time');
                if (p.includes('heartrate') || p.includes('bpm') || p.includes('hr')) foundMetrics.add('heartRate');
                if (p.includes('calorie') || p.includes('kcal')) foundMetrics.add('calories');
                if (p.includes('polyline')) foundMetadata.add('MAP');
                if (p.includes('location')) foundMetadata.add('location');
            };

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

            // Greedy Literal Scan (Fallback)
            const greedyLabels = [...labelKeywords, ...metaKeywords];
            greedyLabels.forEach(gl => {
                if (code.includes(`'${gl}'`) || code.includes(`"${gl}"`)) {
                    if (labelKeywords.includes(gl)) foundLabels.add(gl);
                    else foundMetadata.add(gl);
                }
            });

            return { metrics: Array.from(foundMetrics), labels: Array.from(foundLabels), metadata: Array.from(foundMetadata) };
        };

        const modes: Record<string, any> = {};
        ['run', 'bike', 'workout'].forEach(mode => {
            const analysis = analyzeBlock(combinedBody);
            // Mode pruning
            if (mode === 'workout') {
                analysis.metrics = analysis.metrics.filter(m => m !== 'distance' && m !== 'pace');
                analysis.labels = analysis.labels.filter(l => l !== 'KM' && l !== 'PACE' && l !== '/KM');
            }
            modes[mode] = analysis;
        });

        capabilities[id] = { version: "3.0", renderer: funcs[0] || 'Unknown', modes };

        // Final Overrides
        if (FIXED_CAPABILITIES[id]) {
            const fixed = FIXED_CAPABILITIES[id];
            Object.keys(fixed.modes).forEach(mode => {
                if (capabilities[id].modes[mode]) {
                    capabilities[id].modes[mode].metrics = fixed.modes[mode].metrics;
                    capabilities[id].modes[mode].labels = fixed.modes[mode].labels;
                }
            });
        }
    });

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(capabilities, null, 2));
    console.log(`✅ Capabilites updated at ${OUTPUT_PATH}`);
}

runAgent().catch(console.error);
