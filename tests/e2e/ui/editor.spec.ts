import { test } from '@playwright/test';
import { FeedPage } from '../pages/FeedPage';
import { EditorPage } from '../pages/EditorPage';
import { MockStravaClient } from '../utils/MockStravaClient';

test.describe('Scora App UI: Sticker Editor (POM)', () => {

    test.beforeEach(async ({ page }) => {
        const feedPage = new FeedPage(page);
        const api = new MockStravaClient(page);

        // 1. Setup mock session and Network constraints
        await feedPage.injectMockAuth();
        await api.mockSuccessfulActivities();

        // 2. Base App Load Sequence
        await feedPage.goto();
        await feedPage.waitForLoaderToHide();
    });

    test('Test 2: Switching Templates updates UI styling', async ({ page }) => {
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);

        // Navigate to the editor for a specific mocked run
        await feedPage.openActivityEditor('Carrera por la mañana');
        await editorPage.verifyEditorScreenVisible('Carrera por la mañana');

        // Click Minimal (default state check)
        await editorPage.verifyTemplateIsActive('Minimal');

        // Click Map Route template
        await editorPage.selectTemplate('Route');
        await editorPage.verifyTemplateIsActive('Route');

        // Click Stats
        await editorPage.selectTemplate('Stats');
        await editorPage.verifyTemplateIsActive('Stats');
    });

    test('Test 3: Browser History API "Back" button functions natively', async ({ page }) => {
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);

        // Navigate to editor
        await feedPage.openActivityEditor('Carrera por la mañana');
        await editorPage.verifyEditorScreenVisible('Carrera por la mañana');

        // Trigger History Back API
        await page.goBack();

        // Verify we dropped back specifically into the Feed State
        await feedPage.verifyActivityRendered('Carrera por la mañana', '11.30 km');
    });

    test('Test 4: UI "Back" button mimics Native History API', async ({ page }) => {
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);

        // Navigate to editor
        await feedPage.openActivityEditor('Carrera por la mañana');
        await editorPage.verifyEditorScreenVisible('Carrera por la mañana');

        // Click custom UI Back Button
        await editorPage.goBack();

        // Verify we dropped back specifically into the Feed State
        await feedPage.verifyActivityRendered('Carrera por la mañana', '11.30 km');
    });

    test('Test 5: Selecting alternate activities resets template styling', async ({ page }) => {
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);

        // Open 1st Run
        await feedPage.openActivityEditor('Carrera por la mañana');
        await editorPage.selectTemplate('Route');

        // Go back
        await editorPage.goBack();

        // Open 2nd Run
        await feedPage.openActivityEditor('Morning HIIT Session');

        // Verify UI correctly flushed Route and returned to Minimal
        await editorPage.verifyEditorScreenVisible('Morning HIIT Session');
        await editorPage.verifyTemplateIsActive('Minimal');
    });

});
