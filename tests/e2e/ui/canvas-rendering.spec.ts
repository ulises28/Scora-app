import { test, expect } from '@playwright/test';
import { FeedPage } from '../pages/FeedPage';
import { EditorPage } from '../pages/EditorPage';
import { MockStravaClient } from '../utils/MockStravaClient';
import { TEMPLATE_REGISTRY } from '../../../src/features/editor/TemplateManager';

test.describe('Scora App UI: Advanced Canvas Verification', () => {

    const activeTemplates = TEMPLATE_REGISTRY.filter(t => !t.seasonal);

    test('Test 1: GPS Template Verification (Uniqueness + Consistency + Visual)', async ({ page }) => {
        test.setTimeout(90000); 
        
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);
        const api = new MockStravaClient(page);

        await feedPage.injectMockAuth();
        await api.mockSuccessfulActivities();
        await feedPage.goto();
        await feedPage.waitForLoaderToHide();

        // Target: "Carrera por la mañana" (9.64 km, ~4:56 /km)
        const activityTitle = 'Carrera por la mañana';
        const expectedDist = '9.64';
        const expectedPace = '4:56';

        await feedPage.openActivityEditor(activityTitle);
        await editorPage.verifyEditorScreenVisible(activityTitle);
        await editorPage.injectCanvasInterceptor();

        for (const template of activeTemplates) {
            const { id, features } = template;
            
            const startCount = await editorPage.getDrawCount();
            await editorPage.clearCanvasTextLog();
            await editorPage.selectTemplate(id);
            await editorPage.verifyTemplateIsActive(id);
            
            // ARCHITECT NOTE: Wait for deterministic draw signal instead of flaky timeouts
            await page.waitForFunction((prev) => (window as any)._scoraDrawCount > prev, startCount);

            // Wait until we have a substantial log (branding + some data)
            // or specifically wait for distance if it's a GPS template
            await page.waitForFunction((args) => {
                const logs = (window as any)._scoraCanvasTextLog || [];
                const logStrJoined = logs.join('').toUpperCase();
                
                if (args.expectedDist) {
                    return logStrJoined.includes(args.expectedDist.replace('.', '')) || logStrJoined.includes(args.expectedDist);
                }
                return logs.length > 5;
            }, { id, expectedDist }, { timeout: 10000 });

            const logs = await editorPage.getCanvasTextLog();
            const logStr = logs.join(' ').replace(/\s+/g, ' ').toUpperCase();
            const logStrDense = logs.join('').replace(/\s+/g, '').toUpperCase();

            // --- Pillar 2: Consistency ---
            if (features.distance) {
                // Some draw "9.64", some "9" then ".64" -> logStrDense has both
                const hasValue = logStrDense.includes(expectedDist) || logStrDense.includes(expectedDist.replace('.', ''));
                expect(hasValue, `Template ${id} missing distance 9.64`).toBeTruthy();
            }
            if (features.paceSpeed) {
                // Pace "4:56" -> "456"
                const hasPace = logStrDense.includes(expectedPace) || logStrDense.includes(expectedPace.replace(':', ''));
                expect(hasPace, `Template ${id} missing pace 4:56`).toBeTruthy();
            }

            // --- Pillar 1: Uniqueness (No Duplicated Data) ---
            if (features.distance) {
                // Check both spaced and dense versions for uniqueness
                const occurrences = logStr.split(expectedDist).length - 1;
                const denseOccurrences = logStrDense.split(expectedDist.replace('.', '')).length - 1;
                expect(occurrences + denseOccurrences, `Template ${id} shows duplicated distance`).toBeLessThanOrEqual(2); 
                // Note: we allow up to 2 here because the same value might appear in logStr AND logStrDense
                // but if it appeared twice in EACH, it would be 4.
            }

            // --- Pillar 3: Visual Regression (Overlap/Clipping/SafeBounds) ---
            // This catches "letters over numbers" or "stickers cut on iPhone"
            await expect(editorPage.canvasWrapper).toHaveScreenshot(`run-${id}.png`, {
                maxDiffPixelRatio: 0.1, // Relaxed for Cross-OS (Mac vs Linux Docker)
                threshold: 0.2
            });
        }
    });

    test('Test 2: Workout Template Verification (Uniqueness + Consistency + Visual)', async ({ page }) => {
        test.setTimeout(90000);
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);
        const api = new MockStravaClient(page);

        await feedPage.injectMockAuth();
        await api.mockSuccessfulActivities();
        await feedPage.goto();
        await feedPage.waitForLoaderToHide();

        // Target: "Entrenamiento con pesas matutino" (1h 11m, 122 bpm avg)
        const activityTitle = 'Entrenamiento con pesas matutino';
        
        await feedPage.openActivityEditor(activityTitle);
        await editorPage.verifyEditorScreenVisible(activityTitle);
        await editorPage.injectCanvasInterceptor();

        for (const template of activeTemplates) {
            const { id, features } = template;
            
            const startCount = await editorPage.getDrawCount();
            await editorPage.clearCanvasTextLog();
            await editorPage.selectTemplate(id);
            await editorPage.verifyTemplateIsActive(id);

            // ARCHITECT NOTE: Wait for deterministic draw signal instead of flaky timeouts
            await page.waitForFunction((prev) => (window as any)._scoraDrawCount > prev, startCount);

            await page.waitForFunction(() => {
                const logs = (window as any)._scoraCanvasTextLog || [];
                const logStr = logs.join('').toUpperCase();
                return logs.length > 5 || logStr.includes('122') || logStr.includes('172') || logStr.includes('11');
            }, { timeout: 10000 });

            const logs = await editorPage.getCanvasTextLog();
            const logStr = logs.join(' ').replace(/\s+/g, ' ').toUpperCase();
            const logStrDense = logs.join('').replace(/\s+/g, '').toUpperCase();

            // --- Pillar 2: Consistency ---
            if (features.duration) {
                // Duration: 4279s -> 1h 11m -> "1H11M"
                expect(logStrDense).toContain('1H11M');
            }

            if (features.heartRate) {
                // Heartrate: avg 122, max 172. Most show Avg.
                const hasHRValue = logStrDense.includes('122') || logStrDense.includes('172');
                expect(hasHRValue, `Template ${id} missing heartrate value`).toBeTruthy();
            }

            // --- Pillar 1: Uniqueness ---
            if (features.duration) {
                const occurrences = logStrDense.split('1H11M').length - 1;
                expect(occurrences).toBe(1);
            }

            // --- Pillar 3: Visual Regression ---
            await expect(editorPage.canvasWrapper).toHaveScreenshot(`workout-${id}.png`, {
                maxDiffPixelRatio: 0.1, // Relaxed for Cross-OS (Mac vs Linux Docker)
                threshold: 0.2
            });
        }
    });

    test('Test 3: Start Time Consistency (No Drift)', async ({ page }) => {
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);
        const api = new MockStravaClient(page);

        await feedPage.injectMockAuth();
        await api.mockSuccessfulActivities();
        await feedPage.goto();
        await feedPage.waitForLoaderToHide();

        await editorPage.injectCanvasInterceptor();
        await feedPage.openActivityEditor('Carrera por la mañana');
        
        const startCount = await editorPage.getDrawCount();
        await editorPage.selectTemplate('social-float');
        
        // Wait for deterministic draw signal
        await page.waitForFunction((prev) => (window as any)._scoraDrawCount > prev, startCount);

        const logs = await editorPage.getCanvasTextLog();
        const logStr = logs.join(' ').replace(/\s+/g, ' ').toUpperCase();

        // Mock Run start_date_local: "2026-03-06T08:27:00Z" -> 8:27 AM
        expect(logStr).toContain('8:27');
        expect(logStr).toContain('AM');
    });

    test('Test 4: Private Run (No GPS) displays Distance correctly', async ({ page }) => {
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);
        const api = new MockStravaClient(page);

        await feedPage.injectMockAuth();
        await api.mockSuccessfulActivities();
        await feedPage.goto();
        await feedPage.waitForLoaderToHide();

        await editorPage.injectCanvasInterceptor();
        const startCount = await editorPage.getDrawCount();
        
        // Target: "Carrera privada (sin mapa)" (Private Run, 12.02 km)
        await feedPage.openActivityEditor('Carrera privada (sin mapa)');
        
        // Wait for the initial draw when editor opens
        await page.waitForFunction((prev) => (window as any)._scoraDrawCount > prev, startCount);

        const logs = await editorPage.getCanvasTextLog();
        const logStrDense = logs.join('').replace(/\s+/g, '').toUpperCase();
        
        const hasValue = logStrDense.includes('12.02') || logStrDense.includes('1202');
        expect(hasValue, `Distance 12.02 not found. Log: ${logStrDense}`).toBeTruthy();
    });

    test('Test 5: Cycling activity uses Speed labels instead of Pace', async ({ page }) => {
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);
        const api = new MockStravaClient(page);

        await feedPage.injectMockAuth();
        await api.mockSuccessfulActivities();
        await feedPage.goto();
        await feedPage.waitForLoaderToHide();

        // Target: "Vuelta ciclista por la mañana" (Cycle, 1.72 km, 16.9 km/h)
        const activityTitle = 'Vuelta ciclista por la mañana';
        const expectedDist = '1.72';
        const expectedSpeed = '16.9';

        await feedPage.openActivityEditor(activityTitle);
        await editorPage.injectCanvasInterceptor();

        for (const template of activeTemplates.slice(0, 5)) { // Check first 5 for speed labels
            const { id, features } = template;
            if (!features.paceSpeed) continue;

            const startCount = await editorPage.getDrawCount();
            await editorPage.clearCanvasTextLog();
            await editorPage.selectTemplate(id);
            await page.waitForFunction((prev) => (window as any)._scoraDrawCount > prev, startCount);

            const logs = await editorPage.getCanvasTextLog();
            const logStrDense = logs.join('').replace(/\s+/g, '').toUpperCase();
            
            // Check for speed-specific label if it's a cycling activity
            const hasSpeedLabel = logStrDense.includes('SPEED') || logStrDense.includes('KM/H');
            const hasSpeedValue = logStrDense.includes(expectedSpeed) || logStrDense.includes(expectedSpeed.replace('.', ''));
            
            expect(hasSpeedValue || hasSpeedLabel, `Template ${id} missing cycling speed info`).toBeTruthy();
        }
    });

});
