import { test, expect } from '@playwright/test';
import { FeedPage } from '../pages/FeedPage';
import { EditorPage } from '../pages/EditorPage';
import { MockStravaClient } from '../utils/MockStravaClient';
import { TestUtils } from '../utils/TestUtils';

test.describe('Scora App UI: Canvas Interaction & Reliability @visual', () => {

    test.beforeEach(async ({ page }) => {
        const feedPage = new FeedPage(page);
        const api = new MockStravaClient(page);
        await feedPage.injectMockAuth();
        await api.mockSuccessfulActivities();
        await feedPage.goto();
        await feedPage.waitForLoaderToHide();
    });

    /**
     * TEST: Logo & Color Toggles
     * Verifies that UI controls correctly update both the DOM state and the Canvas render.
     */
    test('Editor: Toggling logo and text color updates UI state and Canvas correctly', async ({ page }) => {
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);

        const activity = TestUtils.findFirstActivityWithDistance()!;
        const stats = TestUtils.getExpectedStats(activity);

        await feedPage.openActivityEditor(activity.name, stats.mainValue);
        await editorPage.verifyEditorScreenVisible(activity.name);
        
        // 🛡️ Setup Interceptor for "Absolute Truth" verification
        await editorPage.injectCanvasInterceptor();

        // 1. Logo Toggle (Using 'minimal' template for neutral background)
        await editorPage.selectTemplate('minimal');
        await editorPage.waitForDrawSettled();

        // Toggle Off
        await editorPage.clearCanvasTextLog();
        await editorPage.setLogo(false);
        let logs = await editorPage.getCanvasTextLog();
        console.log("LOGS AFTER OFF:", logs);
        expect(logs.some(t => t.includes('SCORA.'))).toBe(false);

        // Toggle On
        await editorPage.clearCanvasTextLog();
        await editorPage.setLogo(true);
        logs = await editorPage.getCanvasTextLog();
        console.log("LOGS AFTER ON:", logs);
        expect(logs.some(t => t.includes('SCORA.'))).toBe(true);

        // 2. Text Color Toggle
        await editorPage.setTextColor('black');
        await editorPage.verifyTextColorUIState('black');
        await editorPage.waitForDrawSettled();

        await editorPage.setTextColor('white');
        await editorPage.verifyTextColorUIState('white');
        await editorPage.waitForDrawSettled();
    });

    /**
     * TEST: Metadata Rendering
     * Verifies that the correct activity statistics are being drawn onto the canvas.
     */
    test('Editor: Correct metadata is rendered in the Editor screen and Canvas', async ({ page }) => {
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);
        
        const activity = TestUtils.findFirstActivityWithDistance()!;
        const stats = TestUtils.getExpectedStats(activity);

        await editorPage.injectCanvasInterceptor();
        await feedPage.openActivityEditor(activity.name, stats.mainValue);
        await editorPage.verifyEditorScreenVisible(activity.name);
        await editorPage.waitForDrawSettled();

        // UI Header Verification
        await expect(page.getByTestId('activity-title-main')).toContainText(TestUtils.truncateTitle(activity.name));

        // Canvas "Absolute Truth" Verification
        const logs = await editorPage.getCanvasTextLog();
        const normalizedLogs = TestUtils.normalizeForCanvas(logs.join(' '));
        expect(normalizedLogs).toContain(TestUtils.normalizeForCanvas(stats.mainValue));
    });

    /**
     * TEST: Duration Fallback
     * Verifies that workouts without distance show Duration on the canvas.
     */
    test('Editor: Workout activities without distance correctly display Duration on Canvas', async ({ page }) => {
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);
        
        const activity = TestUtils.findFirstActivityWithoutDistance()!;
        const stats = TestUtils.getExpectedStats(activity);

        await editorPage.injectCanvasInterceptor();
        await feedPage.openActivityEditor(activity.name, stats.mainValue);
        await editorPage.waitForDrawSettled();

        const logs = await editorPage.getCanvasTextLog();
        const normalizedLogs = TestUtils.normalizeForCanvas(logs.join(' '));
        
        expect(normalizedLogs).toContain(TestUtils.normalizeForCanvas(stats.mainValue));
        expect(normalizedLogs).not.toContain('0.00KM');
    });
});
