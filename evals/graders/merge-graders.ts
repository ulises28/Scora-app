/**
 * Merge model-grader + code-grader scores into one 1–10 measure.
 *
 * Inputs:
 *   --code  path to code-grader JSON (from evals:grade:json)
 *   --model path to model/evidence JSON with rubric 1–10 fields
 *           (or strengths/weaknesses/reasoning + verdict)
 *
 * Output: merged JSON + console summary with average.
 *
 *   npx tsx evals/graders/merge-graders.ts \
 *     --code test-results/code-grader.json \
 *     --model evals/reports/latest/evidence.json
 */
import fs from 'fs';
import path from 'path';

function arg(name: string): string | null {
    const i = process.argv.indexOf(name);
    return i >= 0 ? process.argv[i + 1] : null;
}

function avg(nums: number[]): number {
    return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

function clamp10(n: number): number {
    return Math.max(1, Math.min(10, Number(n.toFixed(2))));
}

function main() {
    const codePath = arg('--code');
    const modelPath = arg('--model');

    let codeScore: number | null = null;
    let codeFailClosed = false;
    if (codePath && fs.existsSync(codePath)) {
        const c = JSON.parse(fs.readFileSync(codePath, 'utf-8'));
        codeScore = Number(c.score);
        codeFailClosed = Boolean(c.failClosed);
    }

    let modelScore: number | null = null;
    const rubric: Record<string, number> = {};
    if (modelPath && fs.existsSync(modelPath)) {
        const raw = JSON.parse(fs.readFileSync(modelPath, 'utf-8'));
        const list = Array.isArray(raw) ? raw : raw.cases || raw.results || [raw];
        for (const item of list) {
            const r = item.rubric || item.modelGrader?.rubric;
            if (r && typeof r === 'object') {
                for (const [k, v] of Object.entries(r)) {
                    if (typeof v === 'number') rubric[k] = Math.max(1, Math.min(10, v));
                }
            }
            if (typeof item.score10 === 'number') {
                modelScore = item.score10;
            } else if (typeof item.score === 'number') {
                modelScore = item.score <= 10 ? item.score : item.score * 10;
            }
        }
        const vals = Object.values(rubric);
        if (vals.length) {
            modelScore = clamp10(avg(vals));
        }
    }

    // Merge: 50/50 when both present; fail-closed if either forced 1
    let merged: number;
    if (codeFailClosed) merged = 1;
    else if (codeScore != null && modelScore != null) merged = clamp10(codeScore * 0.5 + modelScore * 0.5);
    else if (codeScore != null) merged = clamp10(codeScore);
    else if (modelScore != null) merged = clamp10(modelScore);
    else merged = 1;

    const rubricAvg = Object.values(rubric).length ? clamp10(avg(Object.values(rubric))) : null;

    const report = {
        scale: '1-10',
        codeGrader: { score: codeScore, failClosed: codeFailClosed, source: codePath },
        modelGrader: { score: modelScore, rubric, rubricAverage: rubricAvg, source: modelPath },
        mergedScore: merged,
        weights: { code: 0.5, model: 0.5 },
        average: merged,
        pass: merged >= 7,
    };

    const outDir = path.resolve('evals/reports/latest');
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, 'merged-grader.json');
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n');

    console.log('Merged grader (1–10)');
    console.log(`  code : ${codeScore ?? '—'}${codeFailClosed ? ' (FAIL-CLOSED)' : ''}`);
    console.log(`  model: ${modelScore ?? '—'}${rubricAvg != null ? ` (rubric avg ${rubricAvg})` : ''}`);
    console.log(`  MERGED SCORE: ${merged}/10  pass=${report.pass}`);
    if (Object.keys(rubric).length) {
        console.log('  rubric:');
        for (const [k, v] of Object.entries(rubric)) console.log(`    ${k}: ${v}`);
    }
    console.log(`\nWrote ${outPath}`);
    if (!report.pass) process.exit(1);
}

main();
