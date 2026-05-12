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

    /**
     * SCENARIO: Adaptive Selection
     * Opening a new activity always resets the sticker to its default adaptive choice
     * based on the sticker-capabilities contract.
     */
    test('Editor: Opening a new activity always resets the sticker to its default adaptive choice', async ({ page }) => {
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);

        const ACTIVITY_WITH_DISTANCE = TestUtils.findFirstActivityWithMap()!;
        const ACTIVITY_WITHOUT_DISTANCE = TestUtils.findFirstActivityWithoutDistance()!;
        const DISTANCE_STATS = TestUtils.getExpectedStats(ACTIVITY_WITH_DISTANCE).mainValue;
        const NODIST_STATS = TestUtils.getExpectedStats(ACTIVITY_WITHOUT_DISTANCE);

        // Open activity and wait for thumbnails to load
        await feedPage.openActivityEditor(ACTIVITY_WITH_DISTANCE.name, DISTANCE_STATS);
        await editorPage.verifyEditorScreenVisible(ACTIVITY_WITH_DISTANCE.name);
        await editorPage.waitForDrawSettled();

        // 🕵️ UI-DRIVEN DISCOVERY: Pick the 2nd visible template from the gallery
        const thumbs = page.locator('.sticker-thumb');
        await expect(thumbs.first()).toBeVisible();
        const alternateId = await thumbs.nth(1).getAttribute('data-template') || 'default';
        
        await editorPage.selectTemplate(alternateId);
        await editorPage.verifyTemplateIsActive(alternateId);

        // Go back to feed and open another activity (Workout)
        await editorPage.goBack();
        await feedPage.openActivityEditor(ACTIVITY_WITHOUT_DISTANCE.name, String(NODIST_STATS.mainValue));

        // 🕵️ CONTRACT-DRIVEN DISCOVERY: 
        // Based on sticker-capabilities.json, find the first sticker that supports this activity type.
        const jsonMode = ACTIVITY_WITHOUT_DISTANCE.type === 'WeightTraining' ? 'workout' : 'run';
        const hasMapData = !!NODIST_STATS.polyline;

        const expectedDefaultId = Object.keys(capabilities).find(id => {
            const mode = (capabilities as any)[id].modes[jsonMode];
            const metrics = mode.metrics || [];
            const metadata = mode.metadata || [];
            const hasSupport = metrics.length > 0 || metadata.length > 0;
            
            if (!hasSupport) return false;

            // 🛡️ Studio Rule: Only hide if the sticker specifically requires a MAP but we have no polyline
            const needsMap = metadata.includes('MAP');
            if (needsMap && !hasMapData) return false;

            return true;
        }) || 'minimal';

        await editorPage.verifyEditorScreenVisible(ACTIVITY_WITHOUT_DISTANCE.name);
        await editorPage.waitForDrawSettled(); 
        
        // Assert the app respects the contract order (Adaptive Verification)
        await editorPage.verifyTemplateIsActive(expectedDefaultId);
    });
});
