/**
 * Language-specific syntax / behavior validators for the code grader.
 * Detects file type and runs the right check. Fail-closed on syntax errors.
 *
 * Usage: npx tsx evals/graders/lang-validators.ts [file...]
 *        or import validateFiles from this module.
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

export type Lang = 'typescript' | 'javascript' | 'python' | 'json' | 'unknown';

export interface LangResult {
    file: string;
    lang: Lang;
    ok: boolean;
    errors: string[];
    warnings: string[];
}

function sh(cmd: string): { code: number; out: string } {
    try {
        const out = execSync(cmd, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
        return { code: 0, out };
    } catch (e: any) {
        return { code: e?.status ?? 1, out: `${e?.stdout || ''}${e?.stderr || ''}` };
    }
}

export function detectLang(file: string): Lang {
    const ext = path.extname(file).toLowerCase();
    if (ext === '.ts' || ext === '.tsx') return 'typescript';
    if (ext === '.js' || ext === '.jsx' || ext === '.mjs' || ext === '.cjs') return 'javascript';
    if (ext === '.py') return 'python';
    if (ext === '.json' || ext === '.jsonc') return 'json';
    return 'unknown';
}

function validateTypeScript(file: string): LangResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    // Full project tsc is authoritative when possible
    const tsc = sh('pnpm exec tsc --noEmit --pretty false 2>&1 | head -40');
    if (tsc.code !== 0 && tsc.out.includes(file.replace(/\\/g, '/'))) {
        const lines = tsc.out.split('\n').filter(l => l.includes(path.basename(file)));
        errors.push(...lines.slice(0, 5));
    }
    // Per-file structural checks
    const src = fs.readFileSync(file, 'utf-8');
    if (/\brequire\s*\(/.test(src) && /from ['"]/.test(src)) {
        warnings.push('mixed require/import');
    }
    const anyCount = (src.match(/:\s*any\b/g) || []).length;
    if (anyCount > 5) warnings.push(`${anyCount} explicit any types`);
    return { file, lang: 'typescript', ok: errors.length === 0, errors, warnings };
}

function validateJavaScript(file: string): LangResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const r = sh(`node --check "${file}" 2>&1`);
    if (r.code !== 0) errors.push(r.out.trim().split('\n').slice(0, 3).join(' | '));
    return { file, lang: 'javascript', ok: errors.length === 0, errors, warnings };
}

function validatePython(file: string): LangResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    // ast parse (no compile side effects)
    const r = sh(`python3 -c "import ast,sys; ast.parse(open(sys.argv[1]).read())" "${file}" 2>&1`);
    if (r.code !== 0) errors.push(r.out.trim().split('\n').slice(-1)[0] || 'syntax error');
    // optional: py_compile
    const r2 = sh(`python3 -m py_compile "${file}" 2>&1`);
    if (r2.code !== 0) errors.push(r2.out.trim().split('\n').slice(-1)[0] || 'compile error');
    return { file, lang: 'python', ok: errors.length === 0, errors, warnings };
}

function validateJson(file: string): LangResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    try {
        JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch (e: any) {
        errors.push(e.message);
    }
    return { file, lang: 'json', ok: errors.length === 0, errors, warnings };
}

export function validateFiles(files: string[]): LangResult[] {
    return files.map((file) => {
        if (!fs.existsSync(file)) {
            return { file, lang: 'unknown', ok: false, errors: ['file not found'], warnings: [] };
        }
        switch (detectLang(file)) {
            case 'typescript': return validateTypeScript(file);
            case 'javascript': return validateJavaScript(file);
            case 'python': return validatePython(file);
            case 'json': return validateJson(file);
            default:
                return { file, lang: 'unknown', ok: true, errors: [], warnings: ['no validator for extension'] };
        }
    });
}

// CLI
if (process.argv[1] && process.argv[1].endsWith('lang-validators.ts')) {
    const files = process.argv.slice(2).filter(a => !a.startsWith('--'));
    const results = files.length ? validateFiles(files) : [];
    for (const r of results) {
        console.log(`${r.ok ? 'OK' : 'FAIL'} [${r.lang}] ${r.file}`);
        for (const e of r.errors) console.log(`  error: ${e}`);
        for (const w of r.warnings) console.log(`  warn: ${w}`);
    }
    if (results.some(r => !r.ok)) process.exit(1);
}
