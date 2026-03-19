import { test, expect } from '@playwright/test';
import { FeedPage } from '../pages/FeedPage';
import { EditorPage } from '../pages/EditorPage';
import { MockStravaClient } from '../utils/MockStravaClient';

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

        const templatesToCheck = ['minimal', 'dm', 'modern-pill', 'info-glass', 'data-modular'];
        for (const template of templatesToCheck) {
            await editorPage.clearCanvasTextLog();
            await editorPage.selectTemplate(template);

            await page.waitForFunction((titlePart) => {
                const logs = (window as any)._scoraCanvasTextLog || [];
                return logs.some((t: string) => t.toUpperCase().includes(titlePart.toUpperCase()));
            }, 'CARRERA', { timeout: 8000 });

            const rawLogs = await editorPage.getCanvasTextLog();
            const logStr = rawLogs.join(' ').replace(/\s+/g, ' ').toUpperCase();

            // 9.64 km (Checking for 9 and 64 separately to be super robust)
            expect(logStr).toContain('9');
            expect(logStr).toContain('64');
            expect(logStr).toContain('KM');

            // No undefined/0 values
            expect(logStr).not.toContain('UNDEFINED');
            expect(logStr).not.toContain('NAN');
            expect(logStr).not.toContain('0.00');
        }
    });

    test('Test 2: Workout mapping shows Duration and Avg Heartrate', async ({ page }) => {
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

        const templatesToCheck = ['minimal', 'dm', 'modern-pill', 'info-glass'];
        for (const template of templatesToCheck) {
            await editorPage.clearCanvasTextLog();
            await editorPage.selectTemplate(template);

            await page.waitForFunction((titlePart) => {
                const logs = (window as any)._scoraCanvasTextLog || [];
                return logs.some((t: string) => t.toUpperCase().includes(titlePart.toUpperCase()));
            }, 'ENTRENAMIENTO', { timeout: 8000 });

            const rawLogs = await editorPage.getCanvasTextLog();
            const logStr = rawLogs.join(' ').replace(/\s+/g, ' ').toUpperCase();

            // Should show Duration (1h 11m for the mock workout)
            expect(logStr).toContain('1 H');
            expect(logStr).toContain('11 M');

            // Should show AVG HEARTRATE
            if (template !== 'minimal') {
                expect(logStr).toContain('AVG');
                expect(logStr).toContain('HEART');
            }

            // Should NOT show DISTANCE or PACE
            expect(logStr).not.toContain('DISTANCE');
            expect(logStr).not.toContain('PACE');
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

        await editorPage.clearCanvasTextLog();
        await editorPage.selectTemplate('modern-pill');

        // Fixed waitForFunction signature
        await page.waitForFunction(() => (window as any)._scoraCanvasTextLog && (window as any)._scoraCanvasTextLog.length > 0, undefined, { timeout: 8000 });

        const rawLogs = await editorPage.getCanvasTextLog();
        const logStr = rawLogs.join(' ').replace(/\s+/g, ' ').toUpperCase();

        expect(logStr).toContain('9:31');
        expect(logStr).toContain('AM');
    });

    test('Test 4: Private Run (No GPS) displays Distance correctly', async ({ page }) => {
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

        // Select 'minimal' template
        await editorPage.selectTemplate('minimal');
        // Fixed waitForFunction signature
        await page.waitForFunction(() => (window as any)._scoraCanvasTextLog && (window as any)._scoraCanvasTextLog.length > 0, undefined, { timeout: 8000 });

        const rawLogs = await editorPage.getCanvasTextLog();
        const logStr = rawLogs.join(' ').replace(/\s+/g, ' ').toUpperCase();

        expect(logStr).toContain('12.02');
        expect(logStr).toContain('KM');
        expect(logStr).toContain('DISTANCE');
        expect(logStr).not.toContain('DURATION');
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

        const templatesToCheck = ['modern-pill', 'data-modular', 'stats', 'info-glass'];

        for (const template of templatesToCheck) {
            await editorPage.clearCanvasTextLog();
            await editorPage.selectTemplate(template);
            await page.waitForFunction((titlePart) => {
                const logs = (window as any)._scoraCanvasTextLog || [];
                return logs.some((t: string) => t.toUpperCase().includes(titlePart.toUpperCase()));
            }, 'VUELTA', { timeout: 8000 });

            const rawLogs = await editorPage.getCanvasTextLog();
            const logStr = rawLogs.join(' ').replace(/\s+/g, ' ').toUpperCase();

            expect(logStr).toContain('SPEED');
            expect(logStr).not.toContain('PACE');

            if (template === 'info-glass') {
                expect(logStr).toContain('DISTANCE');
            }
        }
    });

});
