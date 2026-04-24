import { test, expect } from '@playwright/test';
import { FeedPage } from '../pages/FeedPage';
import { EditorPage } from '../pages/EditorPage';
import { MockStravaClient } from '../utils/MockStravaClient';
import { TEMPLATE_REGISTRY } from '../../../src/features/editor/TemplateManager';
import { TestUtils } from '../utils/TestUtils';
import capabilities from '../fixtures/sticker-capabilities.json' with { type: 'json' };

test.describe('Scora App UI: Data Fallback Intelligence @regression', () => {
    
    // 🛡️ SAFARI-ISOLATION: Zero-touch stabilization for Mobile Safari
    async function stabilizeSafari(page: any, info: any) {
        if (info.project.name === 'Mobile Safari') {
            await page.evaluate(() => document.fonts.ready);
        }
    }

    test.beforeEach(async ({ page }, testInfo) => {
        await stabilizeSafari(page, testInfo);
        const feedPage = new FeedPage(page);
        const api = new MockStravaClient(page);

        await feedPage.injectMockAuth();
        await api.mockSuccessfulActivities();
        await feedPage.goto();
        await feedPage.waitForLoaderToHide();
    });

    /**
     * TEST: 'Discovery-First' Fallback
     * Find a sticker registered as 'distance' category and use it on a 'workout' activity.
     * It should fallback from DISTANCE -> DURATION.
     */
    test('Verify Distance Template handles Workout Activity (Fallback: DISTANCE -> DURATION)', async ({ page }) => {
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);

        // 1. Dynamic Discovery: Find a Distance-Category sticker
        const distanceSticker = TEMPLATE_REGISTRY.find(t => t.category === 'distance')!;
        
        // 2. Find a Workout Activity (No distance)
        const workoutActivity = TestUtils.findFirstActivityWithoutDistance()!;
        const expectedTime = TestUtils.getExpectedStats(workoutActivity).timeStr;

        await feedPage.openActivityEditor(workoutActivity.name);
        await editorPage.verifyEditorScreenVisible(workoutActivity.name);
        await editorPage.injectCanvasInterceptor();

        // 4. Verify the fallback logic via Canvas interception
        await editorPage.clearCanvasTextLog();
        await editorPage.selectTemplate(distanceSticker.id);
        await editorPage.waitForDrawSettled();
        
        const logs = await editorPage.getCanvasTextLog();
        const normalizedLogs = TestUtils.normalizeForCanvas(logs.join(' '));

        const truth = TestUtils.getStickerTruth(distanceSticker.id, 'workout');
        
        // 🧪 Fallback Intelligence: Verify workout-specific metrics/labels appear
        for (const metric of truth.metrics) {
            if (metric === 'duration') {
                expect(normalizedLogs).toContain(TestUtils.normalizeForCanvas(expectedTime));
            }
        }
        for (const label of truth.labels) {
            expect(TestUtils.isLabelMatch(normalizedLogs, label), 
                `Label "${label}" (or sibling) not found for template "${distanceSticker.id}"`).toBeTruthy();
        }

        // Ensure DISTANCE label is NOT present if it's not in the workout truth
        if (!truth.labels.includes('KM') && !truth.labels.includes('DISTANCE')) {
            expect(normalizedLogs).not.toContain('DISTANCE');
        }

        // 5. Visual Proof: Snap the fallback state
        await expect(editorPage.canvasWrapper).toHaveScreenshot(`fallback-dist-to-work-${distanceSticker.id}.png`);
    });

    /**
     * TEST: 'Discovery-First' Forward-Fill
     * Find a sticker registered as 'workout' category and use it on a 'distance' activity.
     * It should correctly display distance if available.
     */
    test('Verify Workout Template handles Distance Activity (Forward-Fill)', async ({ page }) => {
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);

        // 1. Dynamic Discovery: Find a Workout sticker
        const workoutSticker = TEMPLATE_REGISTRY.find(t => t.category === 'workout') || 
                               TEMPLATE_REGISTRY.find(t => t.id === 'science-pro')!;
        
        // 2. Find a Distance Activity
        const runActivity = TestUtils.findFirstActivityWithDistance()!;
        const expectedDist = TestUtils.getExpectedStats(runActivity).distanceVal;

        await feedPage.openActivityEditor(runActivity.name);
        await editorPage.verifyEditorScreenVisible(runActivity.name);
        await editorPage.injectCanvasInterceptor();

        // 3. Select the Workout Sticker
        await editorPage.clearCanvasTextLog();
        await editorPage.selectTemplate(workoutSticker.id);
        await editorPage.waitForDrawSettled();
        
        // 4. Verify it still displays distance if the data exists AND sticker supports it
        const logs = await editorPage.getCanvasTextLog();
        const normalizedLogs = TestUtils.normalizeForCanvas(logs.join(' '));

        const truth = TestUtils.getStickerTruth(workoutSticker.id, 'run');
        
        // 🧪 Forward-Fill Intelligence: Verify distance metrics appear for a Run
        for (const metric of truth.metrics) {
            if (metric === 'distance') {
                const distVal = TestUtils.normalizeForCanvas(expectedDist);
                expect(normalizedLogs).toContain(distVal);
            }
        }
        for (const label of truth.labels) {
            expect(TestUtils.isLabelMatch(normalizedLogs, label), 
                `Label "${label}" (or sibling) not found for template "${workoutSticker.id}"`).toBeTruthy();
        }

        // 5. Visual Proof
        await expect(editorPage.canvasWrapper).toHaveScreenshot(`forward-fill-work-to-dist-${workoutSticker.id}.png`);
    });
});
