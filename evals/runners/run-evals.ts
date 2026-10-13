/**
 * SCORA: Prompt/Agent eval runner (fixture mode)
 *
 * Scores recorded evidence against evals/cases/**.json contracts.
 * Evidence file: evals/reports/<run-id>/evidence.json
 *   { "caseId": "...", "actions": [...], "evidence": [{ "must": "...", "ok": true }] }
 *
 * Usage:
 *   pnpm run evals
 *   npx tsx evals/runners/run-evals.ts --evidence evals/reports/latest/evidence.json
 *
 * Fail-closed: any must_not violation or missing must ⇒ case fail.
 * Never rewrites cases or baselines.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve('evals');
const CASES_DIR = path.join(ROOT, 'cases');
const REPORT_DIR = path.join(ROOT, 'reports');

interface EvalCase {
    id: string;
    title: string;
    expect: { must?: string[]; must_not?: string[] };
    pass_bar?: number;
    scoring?: Record<string, number>;
}

interface Evidence {
    caseId: string;
    actions?: Array<{ type: string; path?: string; detail?: string }>;
    evidence?: Array<{ must: string; ok: boolean; note?: string }>;
    mustNotViolations?: string[];
    mismatches?: string[];
    strengths?: string;
    weaknesses?: string;
    reasoning?: string;
    rubric?: Record<string, number>;
    gradedBy?: string;
}

function loadCases(): EvalCase[] {
    const out: EvalCase[] = [];
    const walk = (dir: string) => {
        for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
            const p = path.join(dir, ent.name);
            if (ent.isDirectory()) walk(p);
            else if (ent.name.endsWith('.json') && !ent.name.endsWith('.schema.json')) {
                out.push(JSON.parse(fs.readFileSync(p, 'utf-8')));
            }
        }
    };
    walk(CASES_DIR);
    return out;
}

function loadEvidence(file: string): Map<string, Evidence> {
    const raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
    const list: Evidence[] = Array.isArray(raw) ? raw : raw.cases || [];
    return new Map(list.map(e => [e.caseId, e]));
}

function scoreCase(c: EvalCase, ev?: Evidence) {
    const must = c.expect.must || [];
    const mustNot = c.expect.must_not || [];

    if (!ev) {
        return {
            id: c.id,
            title: c.title,
            status: 'missing_evidence' as const,
            score: 1,
            score10: 1,
            strengths: '',
            weaknesses: 'No evidence recorded',
            reasoning: 'Case was not executed live; scored 1/10 fail-closed.',
            failed: ['no evidence recorded'],
        };
    }

    const byMust = new Map((ev.evidence || []).map(e => [e.must, e.ok]));
    const failedMust = must.filter(m => byMust.get(m) !== true);
    const unknown = must.filter(m => !byMust.has(m));
    const violations = (ev.mustNotViolations || []).filter(v => mustNot.some(mn => v.includes(mn) || mn.includes(v)));
    const extraViol = (ev.evidence || []).filter(e => mustNot.includes(e.must) && e.ok).map(e => e.must);
    const allViol = [...new Set([...violations, ...extraViol])];

    const contractScore = must.length
        ? (must.length - failedMust.length - unknown.length * 0.5) / must.length
        : 1;
    const clamped = Math.max(0, Math.min(1, contractScore));
    // 1–10 measurement scale
    const score10 = allViol.length ? 1 : Math.max(1, Math.min(10, Math.round(clamped * 10)));
    const passBar = c.pass_bar != null
        ? (c.pass_bar <= 1 ? Math.round(c.pass_bar * 10) : c.pass_bar)
        : 8;
    const status = allViol.length
        ? ('fail_policy' as const)
        : score10 >= passBar && failedMust.length === 0
            ? ('pass' as const)
            : ('fail' as const);

    return {
        id: c.id,
        title: c.title,
        status,
        scale: '1-10',
        score: score10,
        score10,
        strengths: ev.strengths || '',
        weaknesses: ev.weaknesses || '',
        reasoning: ev.reasoning || '',
        failedMust,
        unknownMust: unknown,
        policyViolations: allViol,
        mismatches: ev.mismatches || [],
    };
}

function main() {
    const argIdx = process.argv.indexOf('--evidence');
    const evidencePath = argIdx >= 0
        ? process.argv[argIdx + 1]
        : path.join(REPORT_DIR, 'latest', 'evidence.json');

    const cases = loadCases();
    const evidence = fs.existsSync(evidencePath) ? loadEvidence(evidencePath) : new Map();

    const results = cases.map(c => scoreCase(c, evidence.get(c.id)));
    const pass = results.filter(r => r.status === 'pass').length;
    const fail = results.filter(r => r.status.startsWith('fail')).length;
    const missing = results.filter(r => r.status === 'missing_evidence').length;

    // ── Averages (1–10 rollup) ──────────────────────────────────────────
    const scored = results.map(r => Number(r.score) || 1);
    const overallAvg = scored.length
        ? Number((scored.reduce((a, b) => a + b, 0) / scored.length).toFixed(2))
        : 1;
    const executed = results.filter(r => r.status !== 'missing_evidence');
    const executedAvg = executed.length
        ? Number((executed.reduce((a, b) => a + (Number(b.score) || 1), 0) / executed.length).toFixed(2))
        : 1;

    // Family averages (id prefix before first /)
    const families = new Map<string, number[]>();
    for (const r of results) {
        const fam = String(r.id).split('/')[0];
        const arr = families.get(fam) || [];
        arr.push(Number(r.score) || 1);
        families.set(fam, arr);
    }
    const familyRows = [...families.entries()].map(([fam, vals]) => ({
        family: fam,
        avg: Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)),
        n: vals.length,
    })).sort((a, b) => b.avg - a.avg);

    // Rubric averages from evidence (if any case recorded rubric 1–10)
    const rubricSums = new Map<string, number[]>();
    for (const ev of evidence.values()) {
        const rub = (ev as any).rubric as Record<string, number> | undefined;
        if (!rub) continue;
        for (const [k, v] of Object.entries(rub)) {
            const arr = rubricSums.get(k) || [];
            arr.push(Math.max(1, Math.min(10, Number(v))));
            rubricSums.set(k, arr);
        }
    }
    const rubricAvgs = [...rubricSums.entries()].map(([k, vals]) => ({
        criterion: k,
        avg: Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)),
        n: vals.length,
    }));
    const rubricOverall = rubricAvgs.length
        ? Number((rubricAvgs.reduce((a, b) => a + b.avg, 0) / rubricAvgs.length).toFixed(2))
        : null;

    const lines: string[] = [];
    lines.push('# Prompt / Agent Eval Scorecard');
    lines.push('');
    lines.push(`Run: ${new Date().toISOString()}`);
    lines.push(`Evidence: ${path.relative(process.cwd(), evidencePath)}`);
    lines.push('');
    lines.push(`**${pass} pass · ${fail} fail · ${missing} missing evidence** (of ${cases.length} cases)`);
    lines.push('');
    lines.push('Scale **1–10** (pass bar ≥ 8). Policy violations force **1/10**.');
    lines.push('');
    lines.push('## Rollup averages');
    lines.push('');
    lines.push('| Rollup | Average /10 |');
    lines.push('|--------|------------:|');
    lines.push(`| **Overall** (all cases) | **${overallAvg}** |`);
    lines.push(`| Executed only (excl. missing) | ${executedAvg} |`);
    if (rubricOverall != null) {
        lines.push(`| Rubric criteria mean | ${rubricOverall} |`);
    }
    for (const f of familyRows) {
        lines.push(`| Family \`${f.family}\` (n=${f.n}) | ${f.avg} |`);
    }
    if (rubricAvgs.length) {
        lines.push('');
        lines.push('### Rubric averages');
        lines.push('');
        lines.push('| Criterion | Avg /10 | n |');
        lines.push('|-----------|--------:|--:|');
        for (const r of rubricAvgs.sort((a, b) => b.avg - a.avg)) {
            lines.push(`| ${r.criterion} | ${r.avg} | ${r.n} |`);
        }
    }
    lines.push('');
    lines.push('## Cases');
    lines.push('');
    lines.push('| Case | Status | Score /10 | Strengths | Weaknesses | Reasoning |');
    lines.push('|------|--------|----------:|-----------|------------|-----------|');
    for (const r of results) {
        const sw = (r.strengths || '—').replace(/\n/g, ' ').replace(/\|/g, '/');
        const wk = (r.weaknesses || '—').replace(/\n/g, ' ').replace(/\|/g, '/');
        const rz = (r.reasoning || '—').replace(/\n/g, ' ').replace(/\|/g, '/');
        lines.push(`| \`${r.id}\` | ${r.status} | ${r.score ?? '—'} | ${sw} | ${wk} | ${rz} |`);
    }
    lines.push('');
    lines.push('_Fail-closed: `must_not` violations always fail the case. Do not edit this report to green._');

    const outDir = path.join(REPORT_DIR, 'latest');
    fs.mkdirSync(outDir, { recursive: true });
    const mdPath = path.join(outDir, 'scorecard.md');
    fs.writeFileSync(mdPath, lines.join('\n') + '\n');
    fs.writeFileSync(path.join(outDir, 'scorecard.json'), JSON.stringify({
        scale: '1-10',
        averages: {
            overall: overallAvg,
            executed: executedAvg,
            rubric: rubricOverall,
            byFamily: familyRows,
            byRubric: rubricAvgs,
        },
        results,
    }, null, 2));

    console.log(lines.join('\n'));
    console.log(`\nWrote ${mdPath}`);

    if (fail > 0) process.exit(1);
}

main();
