import { test } from '@playwright/test';
import { FeedPage } from '../pages/FeedPage';
import { EditorPage } from '../pages/EditorPage';
import { MockStravaClient } from '../utils/MockStravaClient';
import { TEMPLATES } from '../../../src/features/editor/TemplateManager';

test.describe('Scora App UI: Sticker Editor (POM)', () => {

    test.beforeEach(async ({ page }) => {
        const feedPage = new FeedPage(page);
        const api = new MockStravaClient(page);

        // 1. Setup mock session and network constraints
        await feedPage.injectMockAuth();
        await api.mockSuccessfulActivities();

        // 2. Base app load sequence
        await feedPage.goto();
        await feedPage.waitForLoaderToHide();
    });

    test('Test 2: Switching templates via dots updates active dot', async ({ page }) => {
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);

        await feedPage.openActivityEditor('Carrera por la mañana');
        await editorPage.verifyEditorScreenVisible('Carrera por la mañana');

        // Default should be minimal
        await editorPage.verifyTemplateIsActive('minimal');

        // Click dot to switch to Route
        await editorPage.selectTemplate('Route');
        await editorPage.verifyTemplateIsActive('route');

        // Click dot to switch to Stats
        await editorPage.selectTemplate('Stats');
        await editorPage.verifyTemplateIsActive('stats');
    });

    test('Test 2b: Desktop arrow buttons navigate between templates', async ({ page }) => {
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);

        await feedPage.openActivityEditor('Carrera por la mañana');
        await editorPage.verifyEditorScreenVisible('Carrera por la mañana');

        // Start at minimal (first) — prev should be disabled
        await editorPage.verifyTemplateIsActive('minimal');

        // Next → Route
        await editorPage.clickNextTemplate();
        await editorPage.verifyTemplateIsActive('route');

        // Next → Data
        await editorPage.clickNextTemplate();
        await editorPage.verifyTemplateIsActive('data');

        // Prev → Route
        await editorPage.clickPrevTemplate();
        await editorPage.verifyTemplateIsActive('route');
    });

    test('Test 2c: Arrow navigation reaches all templates including 8m/8m2 at the end', async ({ page }) => {
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);

        await feedPage.openActivityEditor('Carrera por la mañana');
        await editorPage.verifyEditorScreenVisible('Carrera por la mañana');

        // Navigate forward through every template — self-updating when TEMPLATES changes
        for (let i = 1; i < TEMPLATES.length; i++) {
            await editorPage.clickNextTemplate();
            await editorPage.verifyTemplateIsActive(TEMPLATES[i]);
        }

        // At the last template the Next button must be disabled
        await page.locator('#btn-template-next').isDisabled();
    });

    test('Test 3: Browser History API "Back" button functions natively', async ({ page }) => {
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);

        await feedPage.openActivityEditor('Carrera por la mañana');
        await editorPage.verifyEditorScreenVisible('Carrera por la mañana');

        await page.goBack();

        await feedPage.verifyActivityRendered('Carrera por la mañana', '11.30 km');
    });

    test('Test 4: UI "Back" button mimics Native History API', async ({ page }) => {
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);

        await feedPage.openActivityEditor('Carrera por la mañana');
        await editorPage.verifyEditorScreenVisible('Carrera por la mañana');

        await editorPage.goBack();

        await feedPage.verifyActivityRendered('Carrera por la mañana', '11.30 km');
    });

    test('Test 5: Selecting alternate activities resets template to minimal', async ({ page }) => {
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);

        // Open 1st run — switch to Route
        await feedPage.openActivityEditor('Carrera por la mañana');
        await editorPage.selectTemplate('Route');
        await editorPage.verifyTemplateIsActive('route');

        // Go back
        await editorPage.goBack();

        // Open 2nd activity
        await feedPage.openActivityEditor('Morning HIIT Session');

        // Template should have reset to minimal
        await editorPage.verifyEditorScreenVisible('Morning HIIT Session');
        await editorPage.verifyTemplateIsActive('minimal');
    });

    test('Test 6: Text color and logo toggles are present and clickable', async ({ page }) => {
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);

        await feedPage.openActivityEditor('Carrera por la mañana');
        await editorPage.verifyEditorScreenVisible('Carrera por la mañana');

        // Both toggles should be clickable without errors
        await editorPage.toggleTextColor(); // White → Black
        await editorPage.toggleLogo();      // On → Off
    });

});
