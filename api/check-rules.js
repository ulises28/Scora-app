import fs from 'fs';
import path from 'path';

// Helper to find the function body in CanvasPainter.ts
function findFunctionBody(content, funcName) {
    const startRegex = new RegExp(`export\\s+function\\s+${funcName}\\s*\\(`, 'm');
    const match = content.match(startRegex);
    if (!match) return '';

    const bodyStart = content.indexOf('{', match.index);
    if (bodyStart === -1) return '';

    let depth = 0;
    for (let i = bodyStart; i < content.length; i++) {
        if (content[i] === '{') depth++;
        if (content[i] === '}') depth--;
        if (depth === 0) return content.substring(bodyStart, i + 1);
    }
    return '';
}

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { templateId } = req.query;
    if (!templateId) {
        return res.status(400).json({ error: 'Missing templateId parameter' });
    }

    const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!API_KEY) {
        return res.status(500).json({ 
            error: 'GEMINI_API_KEY is not configured on the server. Please add it to your environment.' 
        });
    }

    try {
        // Resolve paths
        const registryPath = path.resolve('src/features/editor/StickerRegistry.ts');
        const painterPath = path.resolve('src/features/editor/CanvasPainter.ts');
        const rulesPath = path.resolve('.agent/workflows/canvas-templates.md');

        if (!fs.existsSync(registryPath) || !fs.existsSync(painterPath) || !fs.existsSync(rulesPath)) {
            return res.status(500).json({ error: 'Required source files or rules file not found' });
        }

        const registryContent = fs.readFileSync(registryPath, 'utf-8');
        const painterContent = fs.readFileSync(painterPath, 'utf-8');
        const rulesContent = fs.readFileSync(rulesPath, 'utf-8');

        // Extract the render function name for the given templateId
        // Format in registry: { id: 'templateId', ..., render: Renderers.drawSomeTemplate }
        const registryLines = registryContent.split('\n');
        let renderFuncName = '';
        for (const line of registryLines) {
            if (line.includes(`id: '${templateId}'`) || line.includes(`id: "${templateId}"`)) {
                const renderMatch = line.match(/render:\s*(?:Renderers\.)?([a-zA-Z0-9_]+)/);
                if (renderMatch) {
                    renderFuncName = renderMatch[1];
                    break;
                }
            }
        }

        if (!renderFuncName) {
            return res.status(404).json({ error: `Renderer function for template "${templateId}" not found in registry.` });
        }

        // Find the function body
        const funcBody = findFunctionBody(painterContent, renderFuncName);
        if (!funcBody) {
            return res.status(404).json({ error: `Function "${renderFuncName}" not found in CanvasPainter.ts` });
        }

        // Call Gemini using a low-token lightweight model (gemini-2.5-flash)
        const prompt = `
You are Scora's automated design & implementation compliance agent.
Analyze the following HTML5 Canvas template rendering code against the rules described in Scora's ruleset.

### Scora's Ruleset:
${rulesContent}

### Target Function Code:
\`\`\`typescript
export function ${renderFuncName}${funcBody}
\`\`\`

Verify compliance with:
1. Standardized Labels (Rule 3): Verify stats.mainLabel or stats.subLabel are used appropriately, NO hardcoding of labels like "DISTANCE", "PACE", or "DURATION".
2. Split Pace/Speed/Heartrate Units (Rule 3): Verify stats.subValue split logic is applied to prevent unit overlaps.
3. Started Time (Rule 3): Verify stats.startTime is used for started time, NEVER stats.timeStr.
4. No DOM CSS (Rule 4): Verify no DOM/CSS style properties like filter="blur()" or backdrop-blur are drawn. Check for native roundRect, shadowColor, shadowBlur resets, etc.
5. Canvas State Balance: Check that ctx.save() and ctx.restore() are balanced within the code.

Return ONLY a valid JSON object matching this schema:
{
  "templateId": "${templateId}",
  "functionName": "${renderFuncName}",
  "compliant": true / false,
  "score": 0 to 100,
  "violations": [
    {
      "rule": "Rule name/description",
      "severity": "high" | "medium" | "low",
      "details": "Details about why it is a violation and how to fix it."
    }
  ]
}
Do not return any markdown formatting outside of the JSON block. Do not wrap in \`\`\`json. Return pure JSON string.
`;

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
        const response = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    responseMimeType: "application/json"
                }
            })
        });

        if (!response.ok) {
            const errBody = await response.text();
            return res.status(response.status).json({ 
                error: 'Failed to call Gemini API', 
                details: errBody 
            });
        }

        const data = await response.json();
        const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        try {
            const parsedResult = JSON.parse(textResponse.trim());
            return res.status(200).json(parsedResult);
        } catch (parseErr) {
            return res.status(500).json({ 
                error: 'Failed to parse JSON response from Gemini', 
                rawResponse: textResponse 
            });
        }

    } catch (error) {
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
