import { STICKER_LIST } from '../src/features/editor/StickerRegistry';
import fs from 'fs';
import path from 'path';

/**
 * SCORA: Sticker Capability Generator (v4.1 - Sync-Aligned)
 * 
 * Aligned with sticker-integrity.test.ts expectations.
 */

const OUTPUT_PATH = path.resolve('tests/e2e/fixtures/sticker-capabilities.json');

async function syncStickers() {
    console.log('🚀 Synchronizing Sticker Capabilities (v4.1 - Aligned)...');

    const capabilities: Record<string, any> = {};

    STICKER_LIST.forEach(sticker => {
        const modes: Record<string, any> = {};
        
        ['run', 'bike', 'workout'].forEach(mode => {
            const metrics: string[] = [];
            const labels: string[] = [];
            const metadata: string[] = [];
            
            if (sticker.features.distance) metrics.push('distance');
            if (sticker.features.paceSpeed) metrics.push('pace');
            if (sticker.features.heartRate) metrics.push('heartRate');
            if (sticker.features.duration || sticker.features.alwaysShowDuration) {
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
                // Workout mode strictly excludes distance-based metrics and labels
                const workoutMetrics = metrics.filter(m => m !== 'distance' && m !== 'pace');
                const workoutLabels = labels.filter(l => l !== 'KM' && l !== 'PACE' && l !== 'KM/H' && l !== '/KM');
                modes[mode] = { metrics: workoutMetrics, labels: workoutLabels, metadata };
            } else {
                modes[mode] = { metrics, labels, metadata };
            }
        });

        capabilities[sticker.id] = { 
            version: "4.1", 
            supportsCustomColor: !!sticker.supportsCustomColor,
            supportsBlackText: !!sticker.supportsBlackText,
            compact: !!sticker.compact,
            modes 
        };
    });

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(capabilities, null, 2));
    console.log(`✅ Capabilites synchronized at ${OUTPUT_PATH} (${STICKER_LIST.length} stickers)`);
}

syncStickers().catch(console.error);
