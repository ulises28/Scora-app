import fs from 'fs';
import path from 'path';

/**
 * SCORA: Sticker Data Agent (v2.4 - Alias Tracking + Multi-Arg IQ)
 */

const TEMPLATE_MANAGER_PATH = path.resolve('src/features/editor/TemplateManager.ts');
const CANVAS_PAINTER_PATH = path.resolve('src/features/editor/CanvasPainter.ts');
const OUTPUT_PATH = path.resolve('tests/e2e/fixtures/sticker-capabilities.json');

async function runAgent() {
    console.log('🚀 Starting Sticker Data Agent (v2.4 - Alias Tracking + Multi-Arg IQ)...');

    const registryContent = fs.readFileSync(TEMPLATE_MANAGER_PATH, 'utf-8');
    const painterContent = fs.readFileSync(CANVAS_PAINTER_PATH, 'utf-8');

    // 1. Identify all registered templates and their renderer functions
    const stickerMatchRegex = /id:\s*'([^']+)',[\s\S]*?renderer:\s*(?:'([^']+)'|([^,]+))/g;
    const stickerIds: string[] = [];
    const rendererMap: Record<string, string[]> = {};

    let match;
    while ((match = stickerMatchRegex.exec(registryContent)) !== null) {
        const id = match[1];
        const rendererName = match[2] || match[3]?.trim();
        stickerIds.push(id);
        
        if (rendererName.includes('{')) {
          const nested = [...rendererName.matchAll(/:\s*([a-zA-Z0-9]+)/g)].map(m => m[1]);
          rendererMap[id] = nested;
        } else {
          rendererMap[id] = [rendererName];
        }
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
              // Fallback for non-indented closing brace
              const looseRegex = new RegExp(`function ${f}\\([^{]*?\\) \\{([\\s\\S]*?)\n\\}`, 'm');
              const looseMatch = painterContent.match(looseRegex);
              if (looseMatch) combinedBody += looseMatch[1];
            }
        });

        const analyzeBlock = (code: string) => {
          // A. Alias Tracking (v2.4)
          const aliases: Record<string, string> = {};
          const assignRegex = /(?:const|let|var)\s+(\w+)\s*=\s*([^;]+)/g;
          let aMatch;
          while ((aMatch = assignRegex.exec(code)) !== null) {
              const varName = aMatch[1];
              const valExpr = aMatch[2].trim();
              if (valExpr.includes('stats.title')) aliases[varName] = 'title';
              if (valExpr.includes('stats.location')) aliases[varName] = 'location';
              if (valExpr.includes('stats.type')) aliases[varName] = 'title';
              if (valExpr.includes('stats.date')) aliases[varName] = 'date';
              if (valExpr.includes("'KM'") || valExpr.includes('"KM"')) aliases[varName] = 'KM';
              if (valExpr.includes("'PACE'") || valExpr.includes('"PACE"')) aliases[varName] = 'PACE';
              if (valExpr.includes("'TIME'") || valExpr.includes('"TIME"')) aliases[varName] = 'TIME';
              if (valExpr.includes("'BPM'") || valExpr.includes('"BPM"')) aliases[varName] = 'BPM';
          }

          // B. String Detection (v2.4 - Multi-Arg Aware)
          const foundStrings: string[] = [];
          
          // Pattern 1: Basic Drawing (ctx.fillText(text, ...) or ctx.strokeText(text, ...))
          const simpleDrawRegex = /(?:fillText|strokeText|drawVCR|RENDERSOLIDUNIT)\s*\(\s*(?:['"]([^'"]+)['"]|(\w+))/g;
          let sMatch;
          while ((sMatch = simpleDrawRegex.exec(code)) !== null) {
              if (sMatch[1]) foundStrings.push(sMatch[1].toUpperCase());
              else if (aliases[sMatch[2]]) {
                if (aliases[sMatch[2]] === 'title' || aliases[sMatch[2]] === 'location') {
                  // Captured later in metadata
                } else {
                  foundStrings.push(aliases[sMatch[2]].toUpperCase());
                }
              }
          }

          // Pattern 2: Utility Helpers (drawStatWithUnit(ctx, x, y, value, unit))
          const helperRegex = /(?:drawStatWithUnit|drawMetricBlock)\s*\([^,]+,[^,]+,[^,]+,\s*(?:['"]([^'"]+)['"]|(\w+))\s*,\s*(?:['"]([^'"]+)['"]|(\w+))/g;
          let hMatch;
          while ((hMatch = helperRegex.exec(code)) !== null) {
              // Extract Unit (5th arg) - typically the static label
              if (hMatch[3]) foundStrings.push(hMatch[3].toUpperCase());
              else if (aliases[hMatch[4]]) foundStrings.push(aliases[hMatch[4]].toUpperCase());
          }

          const labelKeywords = ['KM', 'PACE', 'BPM', 'TIME', 'KM/H', '/KM', 'DURATION', 'AVG', 'TOTAL', 'BPM', 'KCAL', 'CAL'];
          const metaKeywords = ['STARTED', 'LOCAL TIME', 'TRACKED', 'PERFORMANCE', 'REC', 'GREETING', 'LOCATION', 'LAT', 'LON'];

          const metricIndicators = {
            distance: !!code.match(/(?:distanceVal|mainValue|s1|distVal|distText|\.distance)/),
            pace: !!code.match(/(?:subValue|paceVal|s2|paceText|speedVal|\.pace)/),
            time: !!code.match(/(?:timeStr|s3|duration|\.time)/),
            heartRate: !!code.match(/(?:avgHeartrate|maxHeartrate|BPM|hrVal|\.heartrate)/)
          };

          const metadata = Array.from(new Set([
            ...foundStrings.filter(s => metaKeywords.some(kw => s.includes(kw))),
            ...(code.includes('getGreeting') ? ['GREETING'] : []),
            ...(code.includes('stats.location') || Object.values(aliases).includes('location') ? ['location'] : []),
            ...(code.includes('stats.shortTitle') || code.includes('stats.title') || Object.values(aliases).includes('title') ? ['title'] : []),
            ...(code.includes('polyline') ? ['MAP'] : [])
          ]));

          return {
            metrics: Object.entries(metricIndicators).filter(([_, v]) => v).map(([k]) => k),
            labels: Array.from(new Set(foundStrings.filter(s => labelKeywords.some(kw => s.includes(kw))))),
            metadata
          };
        };

        const baseline = analyzeBlock(combinedBody);

        capabilities[id] = {
            version: "2.4",
            renderer: funcs[0],
            modes: {}
        };

        ['run', 'bike', 'workout'].forEach(mode => {
            const modeRegex = new RegExp(`(?:if\\s*\\(mode\\s*===\\s*['"]${mode}['"]\\)|case\\s*['"]${mode}['"]:)[\\s\\S]*?([\\s\\S]*?)(?:if|case|default|break|})`, 'i');
            const modeMatch = combinedBody.match(modeRegex);
            const modeAnalysis = modeMatch ? analyzeBlock(modeMatch[1]) : null;

            capabilities[id].modes[mode] = {
                metrics: Array.from(new Set([...baseline.metrics, ...(modeAnalysis?.metrics || [])])),
                labels: Array.from(new Set([...baseline.labels, ...(modeAnalysis?.labels || [])])),
                metadata: Array.from(new Set([...baseline.metadata, ...(modeAnalysis?.metadata || [])]))
            };

            if (mode === 'run') capabilities[id].modes[mode].labels = capabilities[id].modes[mode].labels.filter(l => l !== 'KM/H');
            if (mode === 'bike') capabilities[id].modes[mode].labels = capabilities[id].modes[mode].labels.filter(l => l !== 'PACE' && l !== '/KM');
        });
    });

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(capabilities, null, 2));
    console.log(`✅ Success! Metadata Agent (v2.4) generated ${OUTPUT_PATH}`);
}

runAgent().catch(console.error);
