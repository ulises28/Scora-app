import { test, expect } from '@playwright/test';
import { FeedPage } from '../pages/FeedPage';
import { EditorPage } from '../pages/EditorPage';
import { MockStravaClient } from '../utils/MockStravaClient';
import { TEMPLATE_REGISTRY } from '../../../src/features/editor/TemplateManager';
import { TestUtils } from '../utils/TestUtils';

test.describe('Scora App UI: Editor Navigation & Interaction Flows @smoke', () => {

    const ACTIVITY_WITH_DISTANCE = TestUtils.findFirstActivityWithMap()!;
    const ACTIVE_TEMPLATES = TEMPLATE_REGISTRY.filter(t => !t.seasonal);
    const DEFAULT_ID = ACTIVE_TEMPLATES[0].id;
    const DISTANCE_STATS = TestUtils.getExpectedStats(ACTIVITY_WITH_DISTANCE).mainValue;

    test.beforeEach(async ({ page }) => {
        const feedPage = new FeedPage(page);
        const api = new MockStravaClient(page);

        await feedPage.injectMockAuth();
        await api.mockSuccessfulActivities();

        await feedPage.goto();
        await feedPage.waitForLoaderToHide();
    });

    test('Gallery: Selecting a thumbnail updates the main canvas template', async ({ page }) => {
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);

        await feedPage.openActivityEditor(ACTIVITY_WITH_DISTANCE.name, DISTANCE_STATS);
        await editorPage.verifyEditorScreenVisible(ACTIVITY_WITH_DISTANCE.name);

        // Default should be the first active template in the registry
        await editorPage.verifyTemplateIsActive(DEFAULT_ID);

        // Switch to 2nd template via thumbnail
        const secondId = ACTIVE_TEMPLATES[1].id;
        await editorPage.switchTemplateViaThumb(1);
        await editorPage.waitForDrawSettled(); 
        await editorPage.verifyTemplateIsActive(secondId);
        await editorPage.verifyActiveThumbIndex(1);

        // Switch to 3rd template via thumbnail
        const thirdId = ACTIVE_TEMPLATES[2].id;
        await editorPage.switchTemplateViaThumb(2);
        await editorPage.waitForDrawSettled(); 
        await editorPage.verifyTemplateIsActive(thirdId);
        await editorPage.verifyActiveThumbIndex(2);
    });

    test('Gallery: Arrow and Swipe navigation correctly cycles through templates', async ({ page, isMobile }) => {
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);

        await feedPage.openActivityEditor(ACTIVITY_WITH_DISTANCE.name, DISTANCE_STATS);
        await editorPage.verifyEditorScreenVisible(ACTIVITY_WITH_DISTANCE.name);

        // Start at default template (first)
        await editorPage.verifyTemplateIsActive(DEFAULT_ID);

        const nextId = ACTIVE_TEMPLATES[1].id;
        const thirdId = ACTIVE_TEMPLATES[2].id;

        if (isMobile) {
            // Next → 2nd
            await editorPage.swipeLeft();
            await editorPage.waitForDrawSettled(); 
            await editorPage.verifyTemplateIsActive(nextId);

            // Next → 3rd
            await editorPage.swipeLeft();
            await editorPage.waitForDrawSettled(); 
            await editorPage.verifyTemplateIsActive(thirdId);

            // Prev → 2nd
            await editorPage.swipeRight();
            await editorPage.waitForDrawSettled(); 
            await editorPage.verifyTemplateIsActive(nextId);
        } else {
            // Next → 2nd
            await editorPage.clickNextTemplate();
            await editorPage.waitForDrawSettled(); 
            await editorPage.verifyTemplateIsActive(nextId);

            // Next → 3rd
            await editorPage.clickNextTemplate();
            await editorPage.waitForDrawSettled(); 
            await editorPage.verifyTemplateIsActive(thirdId);

            // Prev → 2nd
            await editorPage.clickPrevTemplate();
            await editorPage.waitForDrawSettled(); 
            await editorPage.verifyTemplateIsActive(nextId);
        }
    });

    test('Gallery: Navigation allows reaching every template in the active registry', async ({ page, isMobile }) => {
        test.slow(); // 🚀 Iterates over 50+ templates, needs more time
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);

        await feedPage.openActivityEditor(ACTIVITY_WITH_DISTANCE.name, DISTANCE_STATS);
        await editorPage.verifyEditorScreenVisible(ACTIVITY_WITH_DISTANCE.name);

        // Navigate forward through every template
        for (let i = 1; i < ACTIVE_TEMPLATES.length; i++) {
            if (isMobile) {
                await editorPage.swipeLeft();
            } else {
                await editorPage.clickNextTemplate();
            }
            
            // 🚀 Studio Optimization: Only wait/verify every 10th template to maintain 60s budget
            if (i % 10 === 0 || i === ACTIVE_TEMPLATES.length - 1) {
                await editorPage.waitForDrawSettled(); 
                await editorPage.verifyTemplateIsActive(ACTIVE_TEMPLATES[i].id);
            }
        }

        if (!isMobile) {
            await expect(editorPage.nextTemplateButton).toBeDisabled();
        }
    });

    test('History: Browser "Back" button correctly returns to the activity feed', async ({ page }) => {
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);

        await feedPage.openActivityEditor(ACTIVITY_WITH_DISTANCE.name, DISTANCE_STATS);
        await editorPage.verifyEditorScreenVisible(ACTIVITY_WITH_DISTANCE.name);

        await page.goBack();

        const stats = TestUtils.getExpectedStats(ACTIVITY_WITH_DISTANCE);
        await feedPage.verifyActivityRendered(ACTIVITY_WITH_DISTANCE.name, stats.mainValue);
    });

    test('History: UI "Back" button correctly returns to the activity feed', async ({ page }) => {
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);

        await feedPage.openActivityEditor(ACTIVITY_WITH_DISTANCE.name, DISTANCE_STATS);
        await editorPage.verifyEditorScreenVisible(ACTIVITY_WITH_DISTANCE.name);

        await editorPage.goBack();

        const stats = TestUtils.getExpectedStats(ACTIVITY_WITH_DISTANCE);
        await feedPage.verifyActivityRendered(ACTIVITY_WITH_DISTANCE.name, stats.mainValue);
    });

    test('Download: Clicking the download button generates a PNG with correct naming convention', async ({ page }) => {
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);

        await feedPage.openActivityEditor(ACTIVITY_WITH_DISTANCE.name, DISTANCE_STATS);
        await editorPage.verifyEditorScreenVisible(ACTIVITY_WITH_DISTANCE.name);

        const downloadPromise = page.waitForEvent('download');
        await editorPage.clickDownload();
        const download = await downloadPromise;

        const filename = download.suggestedFilename();
        expect(filename).toMatch(/^scora-\d{4}-\d{2}-\d{2}-\d{6}\.png$/);

        const path = await download.path();
        expect(path).toBeTruthy();
    });

});
