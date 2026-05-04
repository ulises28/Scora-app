// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { STICKER_LIST } from '../../src/features/editor/StickerRegistry';
import capabilities from '../e2e/fixtures/sticker-capabilities.json' with { type: 'json' };

/**
 * SCORA: Sticker Integrity Suite (v3.0 - Modular Contract)
 * 
 * Verifies that the Sticker Data Discovery (Agent) successfully 
 * validated the claims made in the Modular Sticker Registry.
 */

describe.concurrent('Sticker Integrity: Modular Contract', () => {

    const ACTIVE_TEMPLATES = STICKER_LIST.filter(t => !t.seasonal);

    /**
     * Test 1: JSON Synchronization
     * Ensure the capabilities manifest is up-to-date with the Registry.
     */
    it.each(ACTIVE_TEMPLATES)('should have discovery metadata for "$id"', (sticker) => {
        const entry = (capabilities as any)[sticker.id];
        expect(entry, `Sticker "${sticker.id}" exists in Registry but not in sticker-capabilities.json. Run "npm run sync:stickers".`).toBeDefined();
    });

    /**
     * Test 2: Feature Discovery Contract
     * Ensures that every feature claimed in the StickerRegistry was 
     * successfully identified by the code agent during discovery.
     */
    describe.concurrent('Feature Discovery Verification', () => {
        it.each(ACTIVE_TEMPLATES)('should verify discovery of claimed features for "$id"', (sticker) => {
            const entry = (capabilities as any)[sticker.id];
            if (!entry || !entry.modes) return;

            const allModes = Object.values(entry.modes) as any[];

            // 1. Distance Claim
            if (sticker.features.distance) {
                const foundDistance = allModes.some(m => m.metrics?.includes('distance'));
                expect(foundDistance, `Sticker "${sticker.id}" claims "distance" in Registry, but Agent failed to discover distance logic in renderer.`).toBe(true);
            }

            // 2. Pace/Speed Claim
            if (sticker.features.paceSpeed) {
                const foundPace = allModes.some(m => m.metrics?.includes('pace'));
                expect(foundPace, `Sticker "${sticker.id}" claims "paceSpeed" in Registry, but Agent failed to discover pace logic in renderer.`).toBe(true);
            }

            // 3. Heart Rate Claim
            if (sticker.features.heartRate) {
                const foundHR = allModes.some(m => m.metrics?.includes('heartRate'));
                expect(foundHR, `Sticker "${sticker.id}" claims "heartRate" in Registry, but Agent failed to discover heartRate logic in renderer.`).toBe(true);
            }
            
            // 4. Map Claim
            if (sticker.features.map) {
                const foundMap = allModes.some(m => m.metadata?.includes('MAP'));
                expect(foundMap, `Sticker "${sticker.id}" claims "map" in Registry, but Agent failed to discover map/polyline logic in renderer.`).toBe(true);
            }
        });
    });

    /**
     * Test 3: Vitality (No Dead Stickers)
     * Every sticker must draw SOMETHING (either metrics, labels, or meta tokens).
     */
    it.each(ACTIVE_TEMPLATES)('should have discoverable logic in "$id"', (sticker) => {
        const entry = (capabilities as any)[sticker.id];
        if (!entry || !entry.modes) return;

        const totalIdentifiers = Object.values(entry.modes).reduce((acc: number, mode: any) =>
            acc + (mode.metrics?.length || 0) + (mode.labels?.length || 0) + (mode.metadata?.length || 0)
            , 0);

        expect(totalIdentifiers, `Discovery yielded 0 identifiers. Check for Variable Blindness in CanvasPainter.ts.`).toBeGreaterThan(0);
    });

});
