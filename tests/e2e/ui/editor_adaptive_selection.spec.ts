import { test, expect } from '@playwright/test';
import { FeedPage } from '../pages/FeedPage';
import { EditorPage } from '../pages/EditorPage';
import { MockStravaClient } from '../utils/MockStravaClient';
import { TEMPLATE_REGISTRY } from '../../../src/features/editor/TemplateManager';
import { TestUtils } from '../utils/TestUtils';
import capabilities from '../fixtures/sticker-capabilities.json' with { type: 'json' };

test.describe('Scora App UI: Data Fallback Intelligence @regression', () => {
    
    test.beforeEach(async ({ page }) => {
        const feedPage = new FeedPage(page);
        const api = new MockStravaClient(page);
        await feedPage.injectMockAuth();
        await api.mockSuccessfulActivities();
        await feedPage.goto();
        await feedPage.waitForLoaderToHide();
    });

    /**
     * TEST: 'Discovery-First' Fallback
     * Verify distance-category stickers fallback to duration when used on workouts.
     */
    test('Verify Distance Template handles Workout Activity (Fallback: DISTANCE -> DURATION)', async ({ page }) => {
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);

        const distanceSticker = TEMPLATE_REGISTRY.find(t => t.category === 'distance')!;
        const workoutActivity = TestUtils.findFirstActivityWithoutDistance()!;

        await feedPage.openActivityEditor(workoutActivity.name);
        await editorPage.selectTemplate(distanceSticker.id);
        await editorPage.waitForDrawSettled();

        // 🛡️ Visual Assertion: Standard Screenshot
        await expect(editorPage.canvasWrapper).toHaveScreenshot(`fallback-dist-to-work-${distanceSticker.id}.png`);
    });

    /**
     * TEST: 'Discovery-First' Forward-Fill
     * Verify workout-category stickers show distance when used on runs.
     */
    test('Verify Workout Template handles Distance Activity (Forward-Fill)', async ({ page }) => {
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);

        const workoutSticker = TEMPLATE_REGISTRY.find(t => t.category === 'workout') || 
                               TEMPLATE_REGISTRY.find(t => t.id === 'science-pro')!;
        const runActivity = TestUtils.findFirstActivityWithDistance()!;

        await feedPage.openActivityEditor(runActivity.name);
        await editorPage.selectTemplate(workoutSticker.id);
        await editorPage.waitForDrawSettled();

        // 🛡️ Visual Assertion: Standard Screenshot
        await expect(editorPage.canvasWrapper).toHaveScreenshot(`forward-fill-work-to-dist-${workoutSticker.id}.png`);
    });

    /**
     * SCENARIO: Adaptive Selection
     * Opening a new activity always resets the sticker to its default adaptive choice.
     */
    test('Editor: Opening a new activity always resets the sticker to its default adaptive choice', async ({ page }) => {
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);

        const ACTIVITY_WITH_DISTANCE = TestUtils.findFirstActivityWithMap()!;
        const ACTIVITY_WITHOUT_DISTANCE = TestUtils.findFirstActivityWithoutDistance()!;
        const DISTANCE_STATS = TestUtils.getExpectedStats(ACTIVITY_WITH_DISTANCE).mainValue;
        const NODIST_STATS = TestUtils.getExpectedStats(ACTIVITY_WITHOUT_DISTANCE);

        await feedPage.openActivityEditor(ACTIVITY_WITH_DISTANCE.name, DISTANCE_STATS);
        await editorPage.waitForDrawSettled();

        // Select an alternate template
        const thumbs = page.locator('.sticker-thumb');
        const alternateId = await thumbs.nth(1).getAttribute('data-template') || 'default';
        await editorPage.selectTemplate(alternateId);

        // Reset via Go Back and open new activity
        await editorPage.goBack();
        await feedPage.openActivityEditor(ACTIVITY_WITHOUT_DISTANCE.name, String(NODIST_STATS.mainValue));

        // Calculate expected default based on contract
        const jsonMode = ACTIVITY_WITHOUT_DISTANCE.type === 'WeightTraining' ? 'workout' : 'run';
        const expectedDefaultId = Object.keys(capabilities).find(id => {
            const mode = (capabilities as any)[id].modes[jsonMode];
            return mode.metrics.length > 0 || mode.metadata.length > 0;
        }) || 'minimal';

        await editorPage.waitForDrawSettled(); 
        await editorPage.verifyTemplateIsActive(expectedDefaultId);
    });
});
