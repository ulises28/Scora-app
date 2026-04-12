import fs from 'fs';
import path from 'path';

/**
 * SCORA: Sticker Data Agent (v2.4 - Alias Tracking + Multi-Arg IQ)
 */

const TEMPLATE_MANAGER_PATH = path.resolve('src/features/editor/TemplateManager.ts');
const CANVAS_PAINTER_PATH = path.resolve('src/features/editor/CanvasPainter.ts');
const OUTPUT_PATH = path.resolve('tests/e2e/fixtures/sticker-capabilities.json');

async function runAgent() {
    console.log('🚀 Starting Sticker Data Agent (v2.8 - High Fidelity Stabilization)...');

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
        // Look for the ID in the registry
        const entryRegex = new RegExp(`['"]${id}['"]\\s*:\\s*(?:([a-zA-Z0-9]+)|\\{([\\s\\S]*?)\\}|\\([^)]*\\)\\s*=>\\s*([a-zA-Z0-9]+))`, 'm');
        const entryMatch = registryBlock.match(entryRegex);
        
        if (entryMatch) {
          if (entryMatch[1]) {
            rendererMap[id] = [entryMatch[1]];
          } else if (entryMatch[2]) {
            const nested = [...entryMatch[2].matchAll(/:\s*([a-zA-Z0-9]+)/g)].map(m => m[1]);
            rendererMap[id] = nested;
          } else if (entryMatch[3]) {
            rendererMap[id] = [entryMatch[3]];
          }
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
          const labelKeywords = ['KM', 'PACE', 'BPM', 'TIME', 'KM/H', '/KM', 'DURATION', 'AVG', 'TOTAL', 'BPM', 'KCAL', 'CAL'];
          const metaKeywords = ['STARTED', 'LOCAL TIME', 'TRACKED', 'PERFORMANCE', 'REC', 'GREETING', 'LOCATION', 'LAT', 'LON'];

          // Pattern 1: Basic Drawing (ctx.fillText(text, ...) or ctx.strokeText(text, ...))
          const simpleDrawRegex = /(?:fillText|strokeText|drawVCR|renderSolidUnit)\s*\(\s*(?:['"]([^'"]+)['"]|(\w+))/gi;
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
          
          // Pattern 3: Refined Literal Scraper (v2.9)
          // ONLY capture strings that are actually being drawn or are clearly static labels
          const drawingRegex = /(?:fillText|strokeText|renderSolidUnit|drawStatWithUnit|drawVCR|fillTextCentered)\s*\(\s*['"]([^'"]+)['"]/gi;
          let dMatch;
          while ((dMatch = drawingRegex.exec(code)) !== null) {
              const str = dMatch[1].toUpperCase();
              if (str.length > 1 && str.length < 40 && !str.includes('\n')) {
                  foundStrings.push(str);
              }
          }

          // Pattern 4: Static Label Constant Detection
          const commonLabels = ['KM', 'PACE', 'TIME', 'BPM', 'KM/H', '/KM', 'AVG SPEED', 'LOCAL TIME', 'START TIME'];
          commonLabels.forEach(kw => {
              if (code.includes(`'${kw}'`) || code.includes(`"${kw}"`)) {
                  foundStrings.push(kw);
              }
          });


          // C. Property Auditing (v2.7 - Balanced IQ)
          const props = new Set<string>();
          const propRegex = /stats\.([a-zA-Z0-9]+)/g;
          let pMatch;
          while ((pMatch = propRegex.exec(code)) !== null) {
              props.add(pMatch[1]);
          }

          // Strict Metrics (v2.7) - ONLY flag if actually drawn
          const strictProps = new Set<string>();
          const drawingContextRegex = /(?:fillText|strokeText|renderSolidUnit|drawStatWithUnit|drawVCR|fillTextCentered)\s*\([^)]+(stats\.[a-z0-9]+|avgHeartrate|hrVal|hr|heartrate|gain|elevation)[^)]*\)/gi;
          let mMatch;
          while ((mMatch = drawingContextRegex.exec(code)) !== null) {
              const access = mMatch[0].toLowerCase();
              if (access.includes('heartrate') || access.includes('hrval') || access.includes('hr')) strictProps.add('heartRate');
              if (access.includes('gain') || access.includes('elevation')) strictProps.add('elevation');
          }

          const metricIndicators = {
            distance: props.has('distanceVal') || props.has('distance') || props.has('mainValue') || props.has('dataPoints') || !!code.match(/(?:s1|distVal|distText|\.distance)/),
            pace: props.has('paceVal') || props.has('subValue') || props.has('pace') || props.has('dataPoints') || !!code.match(/(?:s2|paceText|speedVal|\.pace)/),
            time: props.has('timeStr') || props.has('duration') || props.has('time') || props.has('dataPoints') || !!code.match(/(?:s3|\.time)/),
            heartRate: strictProps.has('heartRate'),
            elevation: strictProps.has('elevation'),
            date: props.has('rawDate') || props.has('date') || props.has('dateFormatted') || !!code.match(/(?:dateFormatted|rawDate)/)
          };

          const metadata = Array.from(new Set([
            ...foundStrings.filter(s => metaKeywords.some(kw => s.includes(kw))),
            ...(code.includes('getGreeting') || props.has('greeting') ? ['GREETING'] : []),
            ...(props.has('location') ? ['location'] : []),
            ...(props.has('shortTitle') || props.has('title') ? ['title'] : []),
            ...(props.has('dayName') ? ['dayName'] : []),
            ...(props.has('startTime') ? ['startTime'] : []),
            ...(props.has('dayAndNumber') ? ['dayAndNumber'] : []),
            ...(props.has('rawDate') || props.has('dateFormatted') ? ['date'] : []),
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
            version: "2.8",
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
            
            // Refinement: aesthetic-medal run mode shouldn't have time as a metric
            if (id === 'aesthetic-medal' && mode === 'run') {
                capabilities[id].modes[mode].metrics = capabilities[id].modes[mode].metrics.filter(m => m !== 'time');
            }
        });
    });

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(capabilities, null, 2));
    console.log(`✅ Success! Metadata Agent (v2.8) generated ${OUTPUT_PATH}`);
}

runAgent().catch(console.error);
