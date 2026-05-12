import { test, expect } from '@playwright/test';
import { FeedPage } from '../pages/FeedPage';
import { EditorPage } from '../pages/EditorPage';
import { MockStravaClient } from '../utils/MockStravaClient';
import { TestUtils } from '../utils/TestUtils';
import { TEMPLATE_REGISTRY } from '../../../src/features/editor/TemplateManager';

test.describe('Scora App UI: Canvas Rendering Integrity @visual', () => {

    test.beforeEach(async ({ page }) => {
        const feedPage = new FeedPage(page);
        const api = new MockStravaClient(page);
        await feedPage.injectMockAuth();
        await api.mockSuccessfulActivities();
        await feedPage.goto();
        await feedPage.waitForLoaderToHide();
    });

    test('Canvas: Default sticker correctly renders core metadata', async ({ page }) => {
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);
        
        const activity = TestUtils.findFirstActivityWithDistance()!;
        const stats = TestUtils.getExpectedStats(activity);

        await feedPage.openActivityEditor(activity.name, stats.mainValue);
        await editorPage.verifyEditorScreenVisible(activity.name);
        await editorPage.waitForDrawSettled();

        // 🛡️ Visual Integrity: Standard Snapshot Assertion
        await expect(editorPage.canvasWrapper).toHaveScreenshot('default-render.png', {
            maxDiffPixelRatio: 0.01 // Allow for minor sub-pixel rendering differences
        });
    });

    test('Canvas: Toggling logo and text color updates the UI and Redraws', async ({ page }) => {
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);

        const activity = TestUtils.findFirstActivityWithDistance()!;
        const stats = TestUtils.getExpectedStats(activity);

        await feedPage.openActivityEditor(activity.name, stats.mainValue);
        await editorPage.waitForDrawSettled();

        // 1. Verify Logo Toggle (UI State)
        await editorPage.setLogo(false);
        await editorPage.verifyLogoToggleUIState(false);
        await editorPage.waitForDrawSettled();
        await expect(editorPage.canvasWrapper).toHaveScreenshot('logo-off.png');

        await editorPage.setLogo(true);
        await editorPage.verifyLogoToggleUIState(true);
        await editorPage.waitForDrawSettled();
        await expect(editorPage.canvasWrapper).toHaveScreenshot('logo-on.png');

        // 2. Change Text Color
        await editorPage.setTextColor('black');
        await editorPage.verifyTextColorUIState('black');
        await editorPage.waitForDrawSettled();
        await expect(editorPage.canvasWrapper).toHaveScreenshot('text-black.png');
    });

    test('Canvas: Workout activities without distance correctly display Duration', async ({ page }) => {
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);
        
        const activity = TestUtils.findFirstActivityWithoutDistance()!;
        const stats = TestUtils.getExpectedStats(activity);

        await feedPage.openActivityEditor(activity.name, stats.mainValue);
        await editorPage.waitForDrawSettled();

        // 🛡️ Visual Integrity
        await expect(editorPage.canvasWrapper).toHaveScreenshot('workout-duration-render.png');
    });
});
