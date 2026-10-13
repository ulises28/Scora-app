/**
 * SCORA: Snapshot lifecycle audit
 *
 * Goldens are managed assets (qa-architecture.md section 5), not a dump.
 * Every PNG under tests/e2e snapshot folders must belong to:
 *   - an ACTIVE sticker id (display-contract source of truth), or
 *   - an explicit hero id from heroes.json, or
 *   - a named non-sticker fixture (logo-*, workout-duration-render, fallback-*, ...)
 *     listed in KNOWN_NON_STICKER prefixes.
 *
 * Usage: pnpm exec tsx scripts/snapshot-audit.ts [--json]
 * Exit 1 if orphans found (safe for CI).
 */
import fs from 'fs';
import path from 'path';
import { STICKER_LIST, ARCHIVED_STICKER_LIST } from '../src/features/editor/StickerRegistry';

const SNAP_ROOT = path.resolve('tests/e2e');
const HEROES_PATH = path.resolve('tests/e2e/fixtures/heroes.json');

/** Snapshot name prefixes that are not sticker-id goldens. */
const KNOWN_NON_STICKER = [
    'logo-on',
    'logo-off',
    'default-render',
    'workout-duration-render',
];

interface Orphan {
    file: string;
    reason: string;
}

function walk(dir: string, acc: string[] = []): string[] {
    if (!fs.existsSync(dir)) return acc;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, ent.name);
        if (ent.isDirectory()) walk(p, acc);
        else if (ent.name.endsWith('.png') && p.includes('-snapshots')) acc.push(p);
    }
    return acc;
}

/** Match a known sticker id from a snapshot basename (ids may contain hyphens). */
function parseSnapshotId(base: string, knownIds: string[]): { id: string | null; kind: string } {
    // Prefer longest known id contained in the name
    const sorted = [...knownIds].sort((a, b) => b.length - a.length);
    const hit = sorted.find(id => {
        const alt = id.replace(/_/g, '-');
        return base.includes(id) || base.includes(alt);
    });
    if (hit) return { id: hit, kind: 'known' };
    return { id: null, kind: 'unknown' };
}

function main() {
    const active = new Set(STICKER_LIST.map(s => s.id));
    const archived = new Set(ARCHIVED_STICKER_LIST.map(s => s.id));
    const heroesDoc = JSON.parse(fs.readFileSync(HEROES_PATH, 'utf-8'));
    const heroIds = new Set((heroesDoc.heroes || []).map((h: any) => h.id));

    const files = walk(SNAP_ROOT);
    const orphans: Orphan[] = [];
    const kept: string[] = [];
    const archiveGoldens: string[] = [];

    for (const file of files) {
        const base = path.basename(file);
        const rel = path.relative(process.cwd(), file);

        if (KNOWN_NON_STICKER.some(p => base.startsWith(p))) {
            kept.push(rel);
            continue;
        }

        // Adaptive-selection fixtures (fallback-* / forward-fill-*) embed a sticker id
        if (base.startsWith('fallback-') || base.startsWith('forward-fill-')) {
            const archivedHit = [...archived].find(id => base.includes(id) || base.includes(id.replace(/_/g, '-')));
            const activeHit = [...active].find(id => base.includes(id) || base.includes(id.replace(/_/g, '-')));
            if (activeHit && !archivedHit) {
                kept.push(rel);
                continue;
            }
            if (archivedHit) {
                archiveGoldens.push(rel);
                orphans.push({ file: rel, reason: `adaptive fixture references archived sticker "${archivedHit}"` });
                continue;
            }
            orphans.push({ file: rel, reason: 'adaptive fixture with unknown sticker id' });
            continue;
        }

        const knownIds = [...active, ...archived, ...heroIds];
        const { id } = parseSnapshotId(base, knownIds as string[]);
        if (!id) {
            orphans.push({ file: rel, reason: 'unparseable snapshot name' });
            continue;
        }
        // hyphen/underscore normalization
        const idAlt = id.replace(/_/g, '-');
        const idAlt2 = id.replace(/-/g, '_');
        const isActive = active.has(id) || active.has(idAlt) || active.has(idAlt2);
        const isHero = heroIds.has(id) || heroIds.has(idAlt) || heroIds.has(idAlt2);
        const isArchived = archived.has(id) || archived.has(idAlt) || archived.has(idAlt2);

        if (isActive || isHero) {
            kept.push(rel);
        } else if (isArchived) {
            archiveGoldens.push(rel);
            orphans.push({ file: rel, reason: `sticker is ARCHIVED (${id})` });
        } else {
            orphans.push({ file: rel, reason: `unknown sticker id "${id}"` });
        }
    }

    const report = {
        total: files.length,
        kept: kept.length,
        orphans: orphans.length,
        archiveGoldens: archiveGoldens.length,
        orphanList: orphans,
    };

    if (process.argv.includes('--json')) {
        console.log(JSON.stringify(report, null, 2));
    } else {
        console.log(`Snapshot audit: ${report.total} PNGs · keep ${report.kept} · orphans ${report.orphans}`);
        for (const o of orphans) console.log(`  ✗ ${o.file}\n      ${o.reason}`);
        if (orphans.length) {
            console.log(`\nLifecycle debt: delete or re-home ${orphans.length} goldens (qa-architecture.md §5.2).`);
            console.log(`Do NOT auto-update baselines to hide this — review, then remove or promote.`);
        } else {
            console.log('✅ No orphan goldens.');
        }
    }

    if (orphans.length) process.exit(1);
}

main();
