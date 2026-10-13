/**
 * Live evals: run the agent against evals/cases and write evidence.
 *
 * Usage (after agent runs):
 *   npx tsx evals/runners/run-evals-live.ts --collect
 *
 * Collects:
 *   evals/reports/live/<caseId>/evidence.json
 * and merges into evals/reports/latest/evidence.json for `pnpm run evals`.
 *
 * The agent (or a human) must produce per-case evidence while executing
 * the case's user_prompt under the same constraints as production.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve('evals');
const LIVE = path.join(ROOT, 'reports', 'live');
const LATEST = path.join(ROOT, 'reports', 'latest');

function collect() {
    const merged: any[] = [];
    if (!fs.existsSync(LIVE)) {
        console.error(`No live runs at ${LIVE}. Create evals/reports/live/<caseId>/evidence.json from agent transcripts.`);
        process.exit(1);
    }
    for (const dir of fs.readdirSync(LIVE)) {
        const p = path.join(LIVE, dir, 'evidence.json');
        if (!fs.existsSync(p)) continue;
        const ev = JSON.parse(fs.readFileSync(p, 'utf-8'));
        merged.push(ev);
        console.log(`collected ${ev.caseId || dir}`);
    }
    fs.mkdirSync(LATEST, { recursive: true });
    fs.writeFileSync(path.join(LATEST, 'evidence.json'), JSON.stringify(merged, null, 2) + '\n');
    console.log(`\nMerged ${merged.length} live evidence files → evals/reports/latest/evidence.json`);
    console.log('Next: pnpm run evals');
}

const cmd = process.argv[2] || '--collect';
if (cmd === '--collect') collect();
else {
    console.log('Usage: npx tsx evals/runners/run-evals-live.ts --collect');
    process.exit(1);
}
