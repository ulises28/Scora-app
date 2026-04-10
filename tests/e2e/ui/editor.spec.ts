import { test, expect } from '@playwright/test';
import { FeedPage } from '../pages/FeedPage';
import { EditorPage } from '../pages/EditorPage';
import { MockStravaClient } from '../utils/MockStravaClient';
import { TEMPLATE_REGISTRY } from '../../../src/features/editor/TemplateManager';
import { TestUtils } from '../utils/TestUtils';

test.describe('Scora App UI: Sticker Editor (POM)', () => {

    const ACTIVITY_WITH_DISTANCE = TestUtils.findFirstActivityWithDistance()!;
    const ACTIVITY_WITHOUT_DISTANCE = TestUtils.findFirstActivityWithoutDistance()!;
    
    const ACTIVE_TEMPLATES = TEMPLATE_REGISTRY.filter(t => !t.seasonal);
    const DEFAULT_ID = ACTIVE_TEMPLATES[0].id;
    
    const DISTANCE_STATS = TestUtils.getExpectedStats(ACTIVITY_WITH_DISTANCE).mainValue;
    const NODIST_STATS = TestUtils.getExpectedStats(ACTIVITY_WITHOUT_DISTANCE).mainValue;

    test.beforeEach(async ({ page }) => {
        const feedPage = new FeedPage(page);
        const api = new MockStravaClient(page);

        await feedPage.injectMockAuth();
        await api.mockSuccessfulActivities();

        await feedPage.goto();
        await feedPage.waitForLoaderToHide();
    });

    test('Test 2: Switching templates via gallery thumbnails', async ({ page }) => {
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);

        await feedPage.openActivityEditor(ACTIVITY_WITH_DISTANCE.name, DISTANCE_STATS);
        await editorPage.verifyEditorScreenVisible(ACTIVITY_WITH_DISTANCE.name);

        // Default should be the first active template in the registry
        await editorPage.verifyTemplateIsActive(DEFAULT_ID);

        // Switch to 2nd template via thumbnail
        const secondId = ACTIVE_TEMPLATES[1].id;
        await editorPage.switchTemplateViaThumb(1);
        await editorPage.verifyTemplateIsActive(secondId);
        await editorPage.verifyActiveThumbIndex(1);

        // Switch to 3rd template via thumbnail
        const thirdId = ACTIVE_TEMPLATES[2].id;
        await editorPage.switchTemplateViaThumb(2);
        await editorPage.verifyTemplateIsActive(thirdId);
        await editorPage.verifyActiveThumbIndex(2);
    });

    test('Test 2b: Arrow/Swipe navigation between templates', async ({ page, isMobile }) => {
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
            await editorPage.verifyTemplateIsActive(nextId);

            // Next → 3rd
            await editorPage.swipeLeft();
            await editorPage.verifyTemplateIsActive(thirdId);

            // Prev → 2nd
            await editorPage.swipeRight();
            await editorPage.verifyTemplateIsActive(nextId);
        } else {
            // Next → 2nd
            await editorPage.clickNextTemplate();
            await editorPage.verifyTemplateIsActive(nextId);

            // Next → 3rd
            await editorPage.clickNextTemplate();
            await editorPage.verifyTemplateIsActive(thirdId);

            // Prev → 2nd
            await editorPage.clickPrevTemplate();
            await editorPage.verifyTemplateIsActive(nextId);
        }
    });

    test('Test 2c: Navigation reaches all templates in the registry', async ({ page, isMobile }) => {
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);

        await feedPage.openActivityEditor(ACTIVITY_WITH_DISTANCE.name, DISTANCE_STATS);
        await editorPage.verifyEditorScreenVisible(ACTIVITY_WITH_DISTANCE.name);

        // Navigate forward through every template — dynamically derived from registry
        for (let i = 1; i < ACTIVE_TEMPLATES.length; i++) {
            if (isMobile) {
                await editorPage.swipeLeft();
            } else {
                await editorPage.clickNextTemplate();
            }
            await editorPage.verifyTemplateIsActive(ACTIVE_TEMPLATES[i].id);
        }

        if (!isMobile) {
            // At the last template the Next button must be disabled (Desktop only check)
            await expect(editorPage.nextTemplateButton).toBeDisabled();
        }
    });

    test('Test 3: Browser History API "Back" button functions natively', async ({ page }) => {
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);

        await feedPage.openActivityEditor(ACTIVITY_WITH_DISTANCE.name, DISTANCE_STATS);
        await editorPage.verifyEditorScreenVisible(ACTIVITY_WITH_DISTANCE.name);

        await page.goBack();

        // Feed should render the previously open activity with its correct stats
        const stats = TestUtils.getExpectedStats(ACTIVITY_WITH_DISTANCE);
        await feedPage.verifyActivityRendered(ACTIVITY_WITH_DISTANCE.name, stats.mainValue);
    });

    test('Test 4: UI "Back" button mimics Native History API', async ({ page }) => {
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);

        await feedPage.openActivityEditor(ACTIVITY_WITH_DISTANCE.name, DISTANCE_STATS);
        await editorPage.verifyEditorScreenVisible(ACTIVITY_WITH_DISTANCE.name);

        await editorPage.goBack();

        const stats = TestUtils.getExpectedStats(ACTIVITY_WITH_DISTANCE);
        await feedPage.verifyActivityRendered(ACTIVITY_WITH_DISTANCE.name, stats.mainValue);
    });

    test('Test 5: Selecting alternate activities resets template to default (#1)', async ({ page }) => {
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);

        // Open 1st activity — switch to some alternate template (e.g. index 5)
        const alternateId = ACTIVE_TEMPLATES[5].id;
        await feedPage.openActivityEditor(ACTIVITY_WITH_DISTANCE.name, DISTANCE_STATS);
        await editorPage.selectTemplate(alternateId);
        await editorPage.verifyTemplateIsActive(alternateId);

        // Go back to feed and open another activity
        await editorPage.goBack();
        await feedPage.openActivityEditor(ACTIVITY_WITHOUT_DISTANCE.name, NODIST_STATS);

        // Editor should load the new activity but cleanly reset back to default template (#1)
        await editorPage.verifyEditorScreenVisible(ACTIVITY_WITHOUT_DISTANCE.name);
        await editorPage.verifyTemplateIsActive(DEFAULT_ID);
    });

    test('Test 6: Text color and logo toggles update rendering state', async ({ page }) => {
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);

        await feedPage.openActivityEditor(ACTIVITY_WITH_DISTANCE.name, DISTANCE_STATS);
        await editorPage.verifyEditorScreenVisible(ACTIVITY_WITH_DISTANCE.name);

        await editorPage.injectCanvasInterceptor();

        // 1. Verify Logo Toggle (Should remove "SCORA" from rendering)
        const logoToggle = editorPage.logoToggle;

        // On → Off
        let startCount = await editorPage.getDrawCount();
        await editorPage.clearCanvasTextLog();
        await editorPage.setLogo(false);
        await expect(logoToggle).toHaveClass(/right/); // Verify UI state
        await editorPage.waitForDrawSettled();

        let logs = await editorPage.getCanvasTextLog();
        expect(logs.some(l => l.includes('SCORA'))).toBeFalsy();

        // Off → On
        startCount = await editorPage.getDrawCount();
        await editorPage.clearCanvasTextLog();
        await editorPage.setLogo(true);
        await expect(logoToggle).not.toHaveClass(/right/); // Verify UI state
        await editorPage.waitForDrawSettled();

        logs = await editorPage.getCanvasTextLog();
        expect(logs.some(l => l.includes('SCORA'))).toBeTruthy();

        // 2. Verify Color Toggle
        // Find a template that supports black text
        const colorId = ACTIVE_TEMPLATES.find(t => t.supportsBlackText)?.id || DEFAULT_ID;
        await editorPage.selectTemplate(colorId);
        await editorPage.waitForDrawSettled();

        // Both toggles should be clickable without errors
        await editorPage.setTextColor('black'); // White → Black
        await editorPage.waitForDrawSettled();
    });

    test('Test 7: Download button generates a valid image file', async ({ page }) => {
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);

        await feedPage.openActivityEditor(ACTIVITY_WITH_DISTANCE.name, DISTANCE_STATS);
        await editorPage.verifyEditorScreenVisible(ACTIVITY_WITH_DISTANCE.name);

        // Start waiting for the download event
        const downloadPromise = page.waitForEvent('download');
        
        // Trigger the download
        await editorPage.clickDownload();
        
        // Wait for the download to start and resolve
        const download = await downloadPromise;

        // 1. Verify suggested filename matches Scora standards
        const filename = download.suggestedFilename();
        expect(filename).toMatch(/^scora-sticker-.*\.png$/);
        
        // 2. Clear downloand path and ensure it's not empty
        const path = await download.path();
        expect(path).toBeTruthy();
    });

});
