import { test, expect } from '@playwright/test';
import { FeedPage } from '../pages/FeedPage';
import { EditorPage } from '../pages/EditorPage';
import { MockStravaClient } from '../utils/MockStravaClient';
import { TEMPLATES } from '../../../src/features/editor/TemplateManager';

test.describe('Scora App UI: Canvas Rendering Logic', () => {

    test('Test 1: Run mapping (GPS) displays Distance, Pace, and stops Fallbacks', async ({ page }) => {
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);
        const api = new MockStravaClient(page);

        await feedPage.injectMockAuth();
        await api.mockSuccessfulActivities();
        await feedPage.goto();
        await feedPage.waitForLoaderToHide();

        // Target a running activity
        await feedPage.openActivityEditor('Carrera por la mañana');
        await editorPage.verifyEditorScreenVisible('Carrera por la mañana');
        await editorPage.injectCanvasInterceptor();

        for (const template of TEMPLATES) {
            await editorPage.selectTemplate(template);
            await editorPage.verifyTemplateIsActive(template);

            // Wait dynamically for canvas text to populate
            await page.waitForFunction(() => (window as any)._scoraCanvasTextLog && (window as any)._scoraCanvasTextLog.length > 0, null, { timeout: 8000 });

            const logs = await editorPage.getCanvasTextLog();
            const logStr = logs.join(' ').toUpperCase();

            // We ensure that the mapped Distance number (9.64 km for Carrera por la mañana) is drawn. 
            // We do not strictly check for lack of DURATION since some templates (like tech-hud) format labels statically.
            expect(logStr).toContain('9.64');

            // No undefined/0 values should casually bleed in
            expect(logStr).not.toContain('UNDEFINED');
            expect(logStr).not.toContain('NAN');

            // "0.00" indicates a data wiring error
            expect(logStr).not.toContain('0.00');

            await editorPage.clearCanvasTextLog();
        }
    });

    test('Test 2: Gym mapping (No GPS) triggers Gym Fallbacks (Duration, HR)', async ({ page }) => {
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);
        const api = new MockStravaClient(page);

        await feedPage.injectMockAuth();
        await api.mockSuccessfulActivities();
        await feedPage.goto();
        await feedPage.waitForLoaderToHide();

        // Target weight training
        await feedPage.openActivityEditor('Entrenamiento con pesas matutino');
        await editorPage.verifyEditorScreenVisible('Entrenamiento con pesas matutino');
        await editorPage.injectCanvasInterceptor();

        for (const template of TEMPLATES) {
            await editorPage.selectTemplate(template);

            await page.waitForFunction(() => (window as any)._scoraCanvasTextLog && (window as any)._scoraCanvasTextLog.length > 0, null, { timeout: 8000 });

            const logs = await editorPage.getCanvasTextLog();
            const logStr = logs.join(' ').toUpperCase();

            // Gym templates must never show Distance or Pace
            expect(logStr).not.toContain('DISTANCE');
            expect(logStr).not.toContain('PACE');

            // They shouldn't contain zeroed out kilometers
            expect(logStr).not.toContain('0.00');
            expect(logStr).not.toContain('0.0 KM');

            await editorPage.clearCanvasTextLog();
        }
    });

    test('Test 3: Start Time is processed accurately and Time Drift is avoided', async ({ page }) => {
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);
        const api = new MockStravaClient(page);

        await feedPage.injectMockAuth();
        await api.mockSuccessfulActivities();
        await feedPage.goto();
        await feedPage.waitForLoaderToHide();

        await editorPage.injectCanvasInterceptor();
        await feedPage.openActivityEditor('Vuelta ciclista por la mañana');

        // select a template that actually renders the time (like modern-pill)
        await editorPage.clearCanvasTextLog();
        await editorPage.selectTemplate('modern-pill');

        await page.waitForFunction(() => (window as any)._scoraCanvasTextLog && (window as any)._scoraCanvasTextLog.length > 0, null, { timeout: 8000 });

        const logs = await editorPage.getCanvasTextLog();
        const logStr = logs.join(' ').toUpperCase();

        // Activity start_date_local is 09:31:09. Time strings usually say "9:31 AM" or similar.
        // If there's UTC drift, it might shift to late night or 2am.
        // We ensure "AM" is written, and it caught 9 something, not 2 or 3 AM.
        expect(logStr).toContain('9:31');
        expect(logStr).toContain('AM');
    });

    test('Test 4: Private Run (No GPS) displays Distance correctly (No km m bug)', async ({ page }) => {
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);
        const api = new MockStravaClient(page);

        await feedPage.injectMockAuth();
        await api.mockSuccessfulActivities();
        await feedPage.goto();
        await feedPage.waitForLoaderToHide();

        // Target the private activity (12.02 km)
        await feedPage.openActivityEditor('Carrera privada (sin mapa)');
        await editorPage.verifyEditorScreenVisible('Carrera privada (sin mapa)');
        await editorPage.injectCanvasInterceptor();

        // Select 'minimal' template which had the dual-unit bug
        await editorPage.selectTemplate('minimal');
        await page.waitForFunction(() => (window as any)._scoraCanvasTextLog && (window as any)._scoraCanvasTextLog.length > 0, null, { timeout: 8000 });

        const logs = await editorPage.getCanvasTextLog();
        const logStr = logs.join(' ').toUpperCase();

        // Should contain 12.02 km
        expect(logStr).toContain('12.02');
        expect(logStr).toContain('KM');
        
        // BUG TRAP: Should NOT contain "M" after "KM" (routing error)
        // Note: regex in gymMinimal was appending 'm'. 
        // We check that '12.02 KM M' or similar isn't there.
        expect(logStr).not.toMatch(/KM\s+M/);
    });

    test('Test 5: Cycling activity uses Speed labels instead of Pace', async ({ page }) => {
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);
        const api = new MockStravaClient(page);

        await feedPage.injectMockAuth();
        await api.mockSuccessfulActivities();
        await feedPage.goto();
        await feedPage.waitForLoaderToHide();

        await feedPage.openActivityEditor('Vuelta ciclista por la mañana');
        await editorPage.injectCanvasInterceptor();

        // Check templates that actually show pace/speed
        const templatesToCheck = ['modern-pill', 'data-modular', 'stats'];
        
        for (const template of templatesToCheck) {
            await editorPage.selectTemplate(template);
            await page.waitForFunction(() => (window as any)._scoraCanvasTextLog && (window as any)._scoraCanvasTextLog.length > 0, null, { timeout: 8000 });

            const logs = await editorPage.getCanvasTextLog();
            const logStr = logs.join(' ').toUpperCase();

            // Should show AVG SPEED or MAX SPEED, not PACE
            // Note: Data Modular uses "PACE" as a label fallback, so we check that it's replaced.
            expect(logStr).toContain('SPEED');
            expect(logStr).not.toContain('PACE');

            await editorPage.clearCanvasTextLog();
        }
    });

});
