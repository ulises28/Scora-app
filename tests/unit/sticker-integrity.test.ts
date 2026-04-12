import { describe, it, expect } from 'vitest';
import { TEMPLATE_REGISTRY } from '../../src/features/editor/TemplateManager';
import capabilities from '../e2e/fixtures/sticker-capabilities.json' with { type: 'json' };

/**
 * SCORA: Sticker Integrity Suite (v2.6 "Studio Precision")
 * 
 * Verifies that the Sticker Data Agent accurately captures the capabilities
 * defined in the Template Registry.
 */

// ─── Configuration & Exceptions ──────────────────────────────────────────────

const DIST_LABELS = ['KM'];
const PACE_LABELS = ['PACE', '/KM', 'KM/H'];
const HR_LABELS = ['BPM'];

// Templates where features are rendered via pure graphics/non-standard patterns
const FEATURE_EXCEPTIONS = {
    distance: ['pure-map'],
    paceSpeed: [],
    heartRate: ['science-pro', 'editorial-row']
};

// ─── Test Suite ──────────────────────────────────────────────────────────────

describe.concurrent('Sticker Integrity: Metadata vs Registry', () => {

    // We only care about active (non-seasonal) templates for the core suite
    const ACTIVE_TEMPLATES = TEMPLATE_REGISTRY.filter(t => !t.seasonal);

    /**
     * Test 1: Existence
     * Ensure "npm run sync:stickers" has been run for every registered sticker.
     */
    it.each(ACTIVE_TEMPLATES)('should have capability entry for "$id"', (template) => {
        const entry = (capabilities as any)[template.id];
        expect(entry, `Template registered but missing from sticker-capabilities.json.`).toBeDefined();
    });

    /**
     * Test 2: Vitality (Non-Silent)
     * Ensure no sticker has 0 identified identifiers (metrics + labels + metadata).
     */
    it.each(ACTIVE_TEMPLATES)('should not be "silent" for "$id"', (template) => {
        const entry = (capabilities as any)[template.id];
        if (!entry || !entry.modes) return;

        const totalIdentifiers = Object.values(entry.modes).reduce((acc: number, mode: any) =>
            acc + (mode.metrics?.length || 0) + (mode.labels?.length || 0) + (mode.metadata?.length || 0)
            , 0);

        expect(totalIdentifiers, `No metrics, labels, or metadata identified. Check for Variable Blindness in CanvasPainter.ts.`).toBeGreaterThan(0);
    });

    /**
     * Test 3: Feature Consistency
     * Ensures that if a sticker claims a feature in TemplateManager, 
     * the Data Agent actually found it in the code.
     */
    describe.concurrent('Feature Audit', () => {
        it.each(ACTIVE_TEMPLATES)('should verify claimed features for "$id"', (template) => {
            const entry = (capabilities as any)[template.id];
            if (!entry || !entry.modes) return;

            const allModes = Object.values(entry.modes) as any[];

            // A. Distance Feature 
            if (template.features.distance && !FEATURE_EXCEPTIONS.distance.includes(template.id)) {
                const hasDistance = allModes.some(m =>
                    m.metrics?.includes('distance') ||
                    m.labels?.some((l: string) => DIST_LABELS.some(kw => l.includes(kw)))
                );
                expect(hasDistance, `Claims "distance" feature but no KM metrics/labels found.`).toBe(true);
            }

            // B. Pace Feature
            if (template.features.paceSpeed && !FEATURE_EXCEPTIONS.paceSpeed.includes(template.id)) {
                const hasPace = allModes.some(m =>
                    m.metrics?.includes('pace') ||
                    m.labels?.some((l: string) => PACE_LABELS.some(kw => l.includes(kw)))
                );
                expect(hasPace, `Claims "paceSpeed" feature but no PACE/KMH metrics/labels found.`).toBe(true);
            }

            // C. Heart Rate Feature
            if (template.features.heartRate) {
                const hasHR = allModes.some(m =>
                    m.metrics?.includes('heartRate') ||
                    m.labels?.some((l: string) => HR_LABELS.some(kw => l.includes(kw)))
                );
                expect(hasHR, `Claims "heartRate" feature but no BPM metrics/labels found.`).toBe(true);
            }
        });
    });

    /**
     * Test 4: Semantic Accuracy (Fidelidad Total)
     * Ensures specific business rules are met for sport-aware labeling.
     */
    describe.concurrent('Semantic Accuracy', () => {

        it('Ride activities should strictly use "Avg Speed" logic on modernized templates', () => {
            const highFidelityIDs = ['condesa-stack'];

            highFidelityIDs.forEach(id => {
                const entry = (capabilities as any)[id];
                if (!entry || !entry.modes?.bike) return;

                const mode = entry.modes.bike;
                const containsPaceExplicitly = mode.labels?.some((l: string) => l.toUpperCase().includes('PACE'));
                expect(containsPaceExplicitly, `Found explicit "PACE" label in a BIKE mode for "${id}". Use "AVG SPEED" instead.`).not.toBe(true);
            });
        });

        it('Modernized stickers should contain "LOCAL TIME" metadata', () => {
            const highFidelityIDs = ['condesa-stack'];
            highFidelityIDs.forEach(id => {
                const entry = (capabilities as any)[id];
                if (!entry || !entry.modes) return;

                Object.entries(entry.modes).forEach(([modeName, mode]: [string, any]) => {
                    const hasLocalTime = mode.labels?.some((l: string) => l.includes('LOCAL TIME')) ||
                        mode.metadata?.some((m: string) => m.includes('LOCAL TIME'));

                    expect(hasLocalTime, `Template "${id}" (mode: ${modeName}) is missing the "LOCAL TIME" metadata line.`).toBe(true);
                });
            });
        });
    });

});
