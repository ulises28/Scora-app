import { STICKER_LIST } from '../src/features/editor/StickerRegistry';
import fs from 'fs';
import path from 'path';

/**
 * SCORA: Sticker Capability Generator (v4.2 — Single Writer)
 *
 * AUTHORITATIVE writer of tests/e2e/fixtures/sticker-capabilities.json.
 * Run via `pnpm run sync:stickers` (also a pre-step of `test:unit`).
 * Do not use scripts/sticker-data-agent.ts to write this file (audit only).
 *
 * Aligned with sticker-integrity.test.ts expectations.
 * Metrics asserted per mode are **paint contracts** (what the canvas must draw),
 * not aspirational feature flags — see duration rules below.
 */

const OUTPUT_PATH = path.resolve('tests/e2e/fixtures/sticker-capabilities.json');

/** Feature keys this generator understands — unknown keys fail the sync (churn contract). */
const KNOWN_FEATURE_KEYS = new Set([
    'distance', 'paceSpeed', 'duration', 'alwaysShowDuration', 'heartRate', 'heartRateType',
    'date', 'startTime', 'map', 'title', 'location', 'elevation', 'calories', 'temperature',
]);
const KNOWN_PAINT_FORMS = new Set(['numeric', 'spelled', 'segments', 'glyphs']);
const KNOWN_PAINT_METRICS = new Set(['distance', 'time', 'heartRate', 'pace']);

function assertStickerContract(sticker: { id: string; features: Record<string, unknown>; paintForm?: Record<string, string> }) {
    for (const key of Object.keys(sticker.features || {})) {
        if (!KNOWN_FEATURE_KEYS.has(key)) {
            throw new Error(
                `[sticker-sync] Unknown feature key "${key}" on sticker "${sticker.id}". ` +
                `Add it to KNOWN_FEATURE_KEYS only if it has a paint contract.`
            );
        }
    }
    for (const [metric, form] of Object.entries(sticker.paintForm || {})) {
        if (!KNOWN_PAINT_METRICS.has(metric)) {
            throw new Error(`[sticker-sync] Unknown paintForm metric "${metric}" on "${sticker.id}"`);
        }
        if (!KNOWN_PAINT_FORMS.has(form)) {
            throw new Error(`[sticker-sync] Unknown paintForm "${form}" for "${metric}" on "${sticker.id}"`);
        }
    }
}

async function syncStickers() {
    console.log('🚀 Synchronizing Sticker Display Contracts (v4.2 — Single Source of Truth)...');

    const capabilities: Record<string, any> = {};

    STICKER_LIST.forEach(sticker => {
        assertStickerContract(sticker as any);
        const modes: Record<string, any> = {};
        
        ['run', 'bike', 'workout'].forEach(mode => {
            const metrics: string[] = [];
            const labels: string[] = [];
            const metadata: string[] = [];
            
            if (sticker.features.distance) metrics.push('distance');
            if (sticker.features.paceSpeed) metrics.push('pace');
            if (sticker.features.heartRate) metrics.push('heartRate');
            if (sticker.features.elevation) metrics.push('elevation');
            // Duration contract (paint ≠ capability):
            // - `duration` = sticker can paint a duration value (typically workout / no-distance).
            // - `alwaysShowDuration` = also paints duration on distance activities (run/bike).
            // Distance modes only assert `time` when it must appear beside distance.
            const paintsDuration = !!(sticker.features.duration || sticker.features.alwaysShowDuration);
            if (mode === 'workout') {
                if (paintsDuration) metrics.push('time');
            } else if (sticker.features.alwaysShowDuration) {
                metrics.push('time');
            }
            if (sticker.features.date) metrics.push('date');
            if (sticker.features.startTime) metrics.push('startTime');
            if (sticker.features.map) metadata.push('MAP');
            if (sticker.features.heartRateType === 'max') metadata.push('MAX_HR');
            // 'location' = sticker renders stats.location (geocoded city/district)
            if (sticker.features.location || sticker.features.title) metadata.push('location');

            // Map standard labels for the audit
            if (sticker.features.distance) labels.push('KM');
            // Pace label is mode-specific.
            // Run mode  → '/KM'  (renderers write '/km' or 'min/km' as unit text, never the word 'PACE')
            // Bike mode → 'KM/H' (renderers write 'km/h')
            // '/KM' in expectedLabels overrides run-mode default.
            // 'KM/H' in expectedLabels overrides bike-mode default.
            const hasRunPaceOverride = sticker.expectedLabels?.some(l =>
                ['/KM', 'PACE'].includes(l.toUpperCase().replace(/\s/g,''))
            );
            const hasBikePaceOverride = sticker.expectedLabels?.some(l =>
                ['KM/H'].includes(l.toUpperCase().replace(/\s/g,''))
            );
            if (sticker.features.paceSpeed) {
                if (mode === 'bike' && !hasBikePaceOverride) labels.push('KM/H');
                else if (mode !== 'bike' && !hasRunPaceOverride) labels.push('/KM'); // was 'PACE'
            }
            if (sticker.features.heartRate) labels.push('BPM');
            
            // Inject declarative label overrides — filter to mode-appropriate ones.
            // '/KM' is a run-only unit; 'KM/H' is a bike-only unit.
            if (sticker.expectedLabels) {
                const modeLabels = sticker.expectedLabels.filter(l => {
                    const u = l.toUpperCase().replace(/\s/g,'');
                    if (u === '/KM') return mode === 'run'; // run-only
                    if (u === 'KMH' || u === 'KM/H') return mode === 'bike'; // bike-only
                    return true; // all other labels apply to all modes
                });
                labels.push(...modeLabels);
            }
            if (sticker.expectedMetadata) metadata.push(...sticker.expectedMetadata);

            if (mode === 'workout') {
                // Workout mode strictly excludes distance-based metrics/labels and map
                const workoutMetrics = metrics.filter(m => m !== 'distance' && m !== 'pace');
                const workoutLabels = labels.filter(l => l !== 'KM' && l !== 'PACE' && l !== 'KM/H' && l !== '/KM');
                const workoutMeta = metadata.filter(m => m !== 'MAP');
                modes[mode] = { metrics: workoutMetrics, labels: workoutLabels, metadata: workoutMeta, display: buildDisplay(sticker, workoutMetrics) };
            } else {
                modes[mode] = { metrics, labels, metadata, display: buildDisplay(sticker, metrics) };
            }
        });

        capabilities[sticker.id] = {
            version: "4.2",
            supportsCustomColor: !!sticker.supportsCustomColor,
            supportsBlackText: !!sticker.supportsBlackText,
            compact: !!sticker.compact,
            modes
        };
    });

    const payload = {
        $schema: 'sticker-display-contract/v1',
        $comment: 'SOURCE OF TRUTH: which data each sticker displays, per activity mode. Regenerate with pnpm run sync:stickers. Do not hand-edit; do not write from sticker-data-agent.ts.',
        stickers: capabilities,
    };
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(payload, null, 2));
    console.log(`✅ Capabilities synchronized at ${OUTPUT_PATH} (${STICKER_LIST.length} stickers)`);
}

/** Paint form per metric — how the value appears on canvas (drives assertions). */
function buildDisplay(sticker: { paintForm?: Record<string, string> }, metrics: string[]): Record<string, string> {
    const display: Record<string, string> = {};
    for (const m of metrics) {
        if (m === 'distance' || m === 'time' || m === 'heartRate' || m === 'pace' || m === 'elevation') {
            display[m] = sticker.paintForm?.[m] ?? 'numeric';
        }
    }
    return display;
}

syncStickers().catch(console.error);
