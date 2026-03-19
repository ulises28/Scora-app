import { test, expect } from '@playwright/test';
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

        // Default should be social-float (the new #1)
        await editorPage.verifyTemplateIsActive('social-float');

        // Switch to dm (second dot)
        await editorPage.switchTemplateViaDot(1);
        await editorPage.verifyTemplateIsActive('dm');
        await editorPage.verifyActiveDotIndex(1);

        // Switch back to mono-split (third dot)
        await editorPage.switchTemplateViaDot(2);
        await editorPage.verifyTemplateIsActive('mono-split');
        await editorPage.verifyActiveDotIndex(2);
    });

    test('Test 2b: Arrow/Swipe navigation between templates', async ({ page, isMobile }) => {
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);

        await feedPage.openActivityEditor('Carrera por la mañana');
        await editorPage.verifyEditorScreenVisible('Carrera por la mañana');

        // Start at social-float (first) — prev should be disabled
        await editorPage.verifyTemplateIsActive('social-float');

        if (isMobile) {
            // Next → dm
            await editorPage.swipeLeft();
            await editorPage.verifyTemplateIsActive('dm');

            // Next → Mono Split
            await editorPage.swipeLeft();
            await editorPage.verifyTemplateIsActive('mono-split');

            // Prev → dm
            await editorPage.swipeRight();
            await editorPage.verifyTemplateIsActive('dm');
        } else {
            // Next → dm
            await editorPage.clickNextTemplate();
            await editorPage.verifyTemplateIsActive('dm');

            // Next → Mono Split
            await editorPage.clickNextTemplate();
            await editorPage.verifyTemplateIsActive('mono-split');

            // Prev → dm
            await editorPage.clickPrevTemplate();
            await editorPage.verifyTemplateIsActive('dm');
        }
    });

    test('Test 2c: Navigation reaches all templates including 8m/8m2 at the end', async ({ page, isMobile }) => {
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);

        await feedPage.openActivityEditor('Carrera por la mañana');
        await editorPage.verifyEditorScreenVisible('Carrera por la mañana');

        // Navigate forward through every template — self-updating when TEMPLATES changes
        for (let i = 1; i < TEMPLATES.length; i++) {
            if (isMobile) {
                await editorPage.swipeLeft();
            } else {
                await editorPage.clickNextTemplate();
            }
            await editorPage.verifyTemplateIsActive(TEMPLATES[i]);
        }

        if (!isMobile) {
            // At the last template the Next button must be disabled (Desktop only check)
            await expect(page.locator('#btn-template-next')).toBeDisabled();
        }
    });

    test('Test 3: Browser History API "Back" button functions natively', async ({ page }) => {
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);

        await feedPage.openActivityEditor('Carrera por la mañana');
        await editorPage.verifyEditorScreenVisible('Carrera por la mañana');

        await page.goBack();

        await feedPage.verifyActivityRendered('Carrera por la mañana', '9.64 km');
    });

    test('Test 4: UI "Back" button mimics Native History API', async ({ page }) => {
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);

        await feedPage.openActivityEditor('Carrera por la mañana');
        await editorPage.verifyEditorScreenVisible('Carrera por la mañana');

        await editorPage.goBack();

        await feedPage.verifyActivityRendered('Carrera por la mañana', '9.64 km');
    });

    test('Test 5: Selecting alternate activities resets template to default (#1)', async ({ page }) => {
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);

        // Open 1st run — switch to Minimal
        await feedPage.openActivityEditor('Carrera por la mañana');
        await editorPage.selectTemplate('Minimal');
        await editorPage.verifyTemplateIsActive('minimal');

        // Go back to feed and open 2nd workout
        await editorPage.goBack();
        await feedPage.openActivityEditor('Entrenamiento con pesas matutino');

        // Editor should load the new activity but cleanly reset to social-float (#1)
        await editorPage.verifyEditorScreenVisible('Entrenamiento con pesas matutino');
        await editorPage.verifyTemplateIsActive('social-float');
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
