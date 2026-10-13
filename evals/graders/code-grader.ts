/**
 * SCORA Code Grader
 *
 * Grades agent output (git diff or explicit files) against
 * evals/contracts/code-grader-rules.json:
 *   - output length / overcode
 *   - banned content (secrets, PII-ish tokens)
 *   - syntax (tsc / json)
 *   - readability (line length, fn size, nesting)
 *   - comments (max 2 sentences, no commented-out code)
 *   - safety fail-closed
 *
 * Rubric items (completeness, helpfulness, instruction_following,
 * response_quality) are scored by an LLM/human and merged in
 * evidence.json under "rubric" — this tool only averages them.
 *
 * Usage:
 *   npx tsx evals/graders/code-grader.ts                  # grade git diff HEAD
 *   npx tsx evals/graders/code-grader.ts --files a.ts b.ts
 *   npx tsx evals/graders/code-grader.ts --json
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { validateFiles } from './lang-validators';

const RULES_PATH = path.resolve('evals/contracts/code-grader-rules.json');
const rules = JSON.parse(fs.readFileSync(RULES_PATH, 'utf-8'));

interface Finding {
    rule: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    message: string;
    file?: string;
    line?: number;
}

function detectLangSafe(file: string): 'typescript' | 'javascript' | 'python' | 'json' | 'unknown' {
    const ext = path.extname(file).toLowerCase();
    if (ext === '.ts' || ext === '.tsx') return 'typescript';
    if (ext === '.js' || ext === '.jsx' || ext === '.mjs' || ext === '.cjs') return 'javascript';
    if (ext === '.py') return 'python';
    if (ext === '.json' || ext === '.jsonc') return 'json';
    return 'unknown';
}

function sh(cmd: string): { ok: boolean; out: string } {
    try {
        const out = execSync(cmd, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
        return { ok: true, out };
    } catch (e: any) {
        return { ok: false, out: (e?.stdout || '') + (e?.stderr || '') };
    }
}

function stripAnsi(s: string): string {
    return s.replace(/\u001b\[[0-9;]*m/g, '');
}

function collectFiles(): string[] {
    const fi = process.argv.indexOf('--files');
    if (fi >= 0) {
        return process.argv.slice(fi + 1).filter(a => !a.startsWith('--'));
    }
    // Prefer the task diff (working tree + index) — not the entire legacy worktree.
    // --base <ref> grades that ref..HEAD instead of unstaged+staged changes only.
    const base = (() => {
        const i = process.argv.indexOf('--base');
        return i >= 0 ? process.argv[i + 1] : null;
    })();
    const cmd = base
        ? `git diff --name-only ${base}...HEAD`
        : 'git diff --name-only HEAD';
    const diff = sh(cmd).out.trim().split('\n').filter(Boolean);
    const generated = /sticker-capabilities\.json|pnpm-lock\.yaml|package-lock\.json|\.png$|evals\/reports\//;
    return diff.filter(f => /\.(ts|tsx|js|jsx|json|md|css|html)$/.test(f) && !generated.test(f));
}

function diffStat(): { added: number; removed: number } {
    const base = (() => {
        const i = process.argv.indexOf('--base');
        return i >= 0 ? process.argv[i + 1] : null;
    })();
    const cmd = base
        ? `git diff --numstat ${base}...HEAD`
        : 'git diff HEAD --numstat';
    const out = sh(cmd).out;
    let added = 0, removed = 0;
    for (const line of out.split('\n')) {
        const m = line.match(/^(\d+)\s+(\d+)\s+/);
        if (m) {
            added += Number(m[1]);
            removed += Number(m[2]);
        }
    }
    return { added, removed };
}

function commentSentences(text: string): number {
    // rough: sentence enders
    return (text.match(/[.!?。]+/g) || []).length || (text.trim() ? 1 : 0);
}

function matchesPathList(file: string, list: string[] = []): boolean {
    return list.some((p) => {
        const bare = p.replace(/^\*/,'');
        return file.includes(bare) || file.endsWith(p.replace(/^\*/,''));
    });
}

function gradeFiles(files: string[]) {
    const findings: Finding[] = [];
    let overcodeExtraLines = 0;

    // --- length (exclude generated / data fixtures from overcode budget) ---
    const generated = /sticker-capabilities\.json|pnpm-lock\.yaml|package-lock\.json|\.png$/;
    const codeFiles = files.filter(f => !generated.test(f));
    const { added, removed } = diffStat();
    const maxLines = rules.output_length.max_diff_lines_for_feature;
    // Approximate: full-diff size minus obviously generated blobs is hard; use total but note generated
    const generatedNote = files.filter(f => generated.test(f)).map(f => f);
    if (added > maxLines) {
        overcodeExtraLines = added - maxLines;
        const sev = generatedNote.length ? 'low' : 'medium';
        findings.push({
            rule: 'output_length',
            severity: sev as Finding['severity'],
            message: `Diff adds ~${added} lines (budget ${maxLines}).${generatedNote.length ? ` Includes generated: ${generatedNote.join(', ')}.` : ''} Possible overcode (+${overcodeExtraLines}).`,
        });
    }

    for (const file of files) {
        if (!fs.existsSync(file)) continue;
        const src = fs.readFileSync(file, 'utf-8');
        const lines = src.split('\n');
        const skipLongLines = matchesPathList(file, rules.readability.ignore_line_length_paths || []);
        const skipComments = matchesPathList(file, rules.comments.ignore_paths || []);

        // --- banned content ---
        for (const p of rules.banned_content.patterns) {
            const re = new RegExp(p.regex, p.ignoreCase ? 'gi' : 'g');
            let m: RegExpExecArray | null;
            while ((m = re.exec(src))) {
                const before = src.slice(0, m.index);
                const line = before.split('\n').length;
                const allow: string[] = p.allowlist || [];
                if (allow.some(a => m![0].includes(a))) continue;
                // skip obvious placeholders
                if (/your[_-]|xxx|placeholder|example/i.test(m[0])) continue;
                findings.push({
                    rule: `banned_content.${p.id}`,
                    severity: p.severity as Finding['severity'],
                    message: `${p.label}: "${m[0].slice(0, 24)}…"`,
                    file,
                    line,
                });
            }
        }

        // --- readability ---
        if (!skipLongLines) {
            lines.forEach((ln, i) => {
                if (ln.length > rules.readability.max_avg_line_length) {
                    findings.push({
                        rule: 'readability.long_line',
                        severity: 'low',
                        message: `Line length ${ln.length} > ${rules.readability.max_avg_line_length}`,
                        file,
                        line: i + 1,
                    });
                }
            });
        }

        // function size (export function / function)
        const fnRe = /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g;
        let fm: RegExpExecArray | null;
        while ((fm = fnRe.exec(src))) {
            const start = src.indexOf('{', fm.index);
            if (start < 0) continue;
            let depth = 0, end = start, maxNest = 0;
            for (let i = start; i < src.length; i++) {
                if (src[i] === '{') {
                    depth++;
                    maxNest = Math.max(maxNest, depth);
                } else if (src[i] === '}') {
                    depth--;
                    if (depth === 0) {
                        end = i;
                        break;
                    }
                }
            }
            const loc = src.slice(fm.index, end).split('\n').length;
            if (loc > rules.readability.max_function_loc) {
                findings.push({
                    rule: 'readability.function_loc',
                    severity: 'medium',
                    message: `${fm[1]}() is ${loc} LOC (max ${rules.readability.max_function_loc})`,
                    file,
                });
            }
            if (maxNest - 1 > rules.readability.max_nesting_depth) {
                findings.push({
                    rule: 'readability.nesting',
                    severity: 'low',
                    message: `${fm[1]}() nesting depth ${maxNest - 1} > ${rules.readability.max_nesting_depth}`,
                    file,
                });
            }
        }

        // --- comments ---
        if (!skipComments) {
            const blockRe = /\/\*[\s\S]*?\*\//g;
            let bm: RegExpExecArray | null;
            while ((bm = blockRe.exec(src))) {
                const body = bm[0].replace(/^[/*\s]+|[/*\s]+$/g, '');
                const sentences = commentSentences(body);
                const blockLines = bm[0].split('\n').length;
                if (sentences > rules.comments.max_sentences_per_comment) {
                    findings.push({
                        rule: 'comments.sentences',
                        severity: 'low',
                        message: `Comment block has ~${sentences} sentences (max ${rules.comments.max_sentences_per_comment})`,
                        file,
                    });
                }
                if (blockLines > rules.comments.max_comment_block_lines) {
                    findings.push({
                        rule: 'comments.block_size',
                        severity: 'low',
                        message: `Comment block ${blockLines} lines (max ${rules.comments.max_comment_block_lines})`,
                        file,
                    });
                }
            }
            if (rules.comments.ban_commented_out_code) {
                lines.forEach((ln, i) => {
                    const t = ln.trim();
                    if (/^\/\/\s*(const|let|var|function|if\s*\(|return\s|import\s)/.test(t)) {
                        findings.push({
                            rule: 'comments.commented_out_code',
                            severity: 'low',
                            message: `Commented-out code: ${t.slice(0, 40)}`,
                            file,
                            line: i + 1,
                        });
                    }
                });
            }
        }

        // --- language syntax / behavior validators ---
        const lang = detectLangSafe(file);
        if (lang !== 'unknown') {
            const [vr] = validateFiles([file]);
            if (vr && !vr.ok) {
                findings.push({
                    rule: `syntax.${vr.lang}`,
                    severity: 'critical',
                    message: vr.errors.join(' | ') || 'validation failed',
                    file,
                });
            }
            for (const w of vr?.warnings || []) {
                findings.push({ rule: `syntax.${vr.lang}.warn`, severity: 'low', message: w, file });
            }
        }

        // --- json syntax ---
        if (file.endsWith('.json')) {
            try {
                JSON.parse(src);
            } catch (e: any) {
                findings.push({
                    rule: 'syntax.json',
                    severity: 'critical',
                    message: `Invalid JSON: ${e.message}`,
                    file,
                });
            }
        }
    }

    // --- typescript syntax (if any ts files) ---
    const tsFiles = files.filter(f => /\.tsx?$/.test(f) && !f.includes('.d.ts'));
    if (tsFiles.length) {
        const r = sh('pnpm exec tsc --noEmit');
        if (!r.ok) {
            findings.push({
                rule: 'syntax.typescript',
                severity: 'critical',
                message: stripAnsi(r.out).split('\n').filter(l => l.includes('error')).slice(0, 5).join(' | ') || 'tsc failed',
            });
        }
    }

    return { findings, added, removed, overcodeExtraLines };
}

/** Map deterministic penalty score (0..1) to 1..10 measurement scale. */
function toTen(unitScore: number): number {
    return Math.max(1, Math.min(10, Math.round(unitScore * 10)));
}

function scoreFromFindings(findings: Finding[], rubric?: Record<string, number>) {
    let score = 1;
    let failClosed = false;
    let lowPen = 0;
    let medPen = 0;
    for (const f of findings) {
        if (f.severity === 'critical') {
            failClosed = true;
            continue;
        }
        if (f.severity === 'high') score -= 0.2;
        else if (f.severity === 'medium') medPen += 0.08;
        else lowPen += 0.02;
    }
    score -= Math.min(0.25, medPen);
    score -= Math.min(0.15, lowPen);

    let rubricAverage: number | null = null;
    if (rubric && Object.keys(rubric).length) {
        const vals = Object.values(rubric).map(v => Math.max(1, Math.min(10, v)));
        rubricAverage = Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2));
        score = score * 0.7 + (rubricAverage / 10) * 0.3;
    }
    const score10 = failClosed ? 1 : toTen(Math.max(0, Math.min(1, score)));
    const passBar = rules.scale?.pass_bar ?? 7;
    return {
        scale: '1-10',
        score: score10,
        score_unit: Number(Math.max(0, Math.min(1, score)).toFixed(3)),
        rubricAverage,
        failClosed,
        pass: !failClosed && score10 >= passBar,
    };
}

function main() {
    const files = collectFiles();
    const { findings, added, removed, overcodeExtraLines } = gradeFiles(files);

    // optional rubric from evidence: --rubric path
    let rubric: Record<string, number> | undefined;
    const ri = process.argv.indexOf('--rubric');
    if (ri >= 0 && fs.existsSync(process.argv[ri + 1])) {
        const ev = JSON.parse(fs.readFileSync(process.argv[ri + 1], 'utf-8'));
        rubric = ev.rubric;
    }

    const graded = scoreFromFindings(findings, rubric);
    const report = {
        files: files.length,
        diff: { added, removed },
        overcodeExtraLines,
        findings,
        rubric: rubric || null,
        ...graded,
        gradedAt: new Date().toISOString(),
    };

    if (process.argv.includes('--json')) {
        console.log(JSON.stringify(report, null, 2));
    } else {
        console.log('Code Grader  (scale 1–10, pass ≥ 7)');
        console.log(`  files=${files.length}  +${added}/-${removed}`);
        console.log(`  SCORE: ${graded.score}/10${graded.failClosed ? '  FAIL-CLOSED → 1/10' : ''}  pass=${graded.pass}`);
        if (overcodeExtraLines > 0) {
            console.log(`  overcode: +${overcodeExtraLines} lines over feature budget`);
        }
        if (!findings.length) console.log('  no findings');
        for (const f of findings) {
            console.log(`  [${f.severity}] ${f.rule}${f.file ? ` ${f.file}:${f.line || ''}` : ''} — ${f.message}`);
        }
        console.log(`\n  rubric 1–10 (human/LLM): completeness · helpfulness · instruction_following · response_quality · safety · overcode_control · readability · comment_quality · syntax_health · secret_hygiene`);
        console.log(`  bands: 9–10 excellent · 7–8 good · 5–6 acceptable · 3–4 weak · 1–2 fail`);
    }

    if (!graded.pass) process.exit(1);
}

main();
