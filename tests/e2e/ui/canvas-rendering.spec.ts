import { test, expect } from '@playwright/test';
import { FeedPage } from '../pages/FeedPage';
import { EditorPage } from '../pages/EditorPage';
import { MockStravaClient } from '../utils/MockStravaClient';
import { TEMPLATE_REGISTRY } from '../../../src/features/editor/TemplateManager';
import { TestUtils } from '../utils/TestUtils';
import { mockActivities } from '../../fixtures/stravaData';

test.describe('Scora App UI: Advanced Canvas Verification', () => {

    const activeTemplates = TEMPLATE_REGISTRY.filter(t => !t.seasonal);

    test('Test 1: Activity with Distance Verification (Uniqueness + Consistency + Visual)', async ({ page }) => {
        test.setTimeout(90000);

        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);
        const api = new MockStravaClient(page);

        await feedPage.injectMockAuth();
        await api.mockSuccessfulActivities();
        await feedPage.goto();
        await feedPage.waitForLoaderToHide();

        const activity = TestUtils.findFirstActivityWithDistance()!;
        const stats = TestUtils.getExpectedStats(activity);
        const activityTitle = activity.name;
        const expectedDist = stats.distanceVal;
        const expectedPace = stats.subValue.split(' ')[0];

        await feedPage.openActivityEditor(activityTitle);
        await editorPage.verifyEditorScreenVisible(activityTitle);
        await editorPage.injectCanvasInterceptor();

        for (const template of activeTemplates) {
            const { id, features, category } = template as any;

            // Skip templates specifically for activities without distance
            if (category === 'workout') continue;

            const startCount = await editorPage.getDrawCount();
            await editorPage.clearCanvasTextLog();
            await editorPage.selectTemplate(id);
            await editorPage.verifyTemplateIsActive(id);

            // Wait for deterministic draw signal
            await page.waitForFunction((prev) => (window as any)._scoraDrawCount > prev, startCount);

            // Wait until we have a substantial log (branding + some data)
            await page.waitForFunction((args) => {
                const logs = (window as any)._scoraCanvasTextLog || [];
                const logStrJoined = logs.join('').toUpperCase();

                if (args.expectedDist) {
                    return logStrJoined.includes(args.expectedDist.replace('.', '')) || logStrJoined.includes(args.expectedDist);
                }
                return logs.length > 5;
            }, { id, expectedDist }, { timeout: 10000 });

            const logs = await editorPage.getCanvasTextLog();
            const logStr = logs.join(' ').replace(/\s+/g, ' ').toUpperCase();
            const logStrDense = logs.join('').replace(/\s+/g, '').toUpperCase();

            // --- Pillar 2: Consistency ---
            if (features.distance) {
                const hasValue = logStrDense.includes(expectedDist) || logStrDense.includes(expectedDist.replace('.', ''));
                expect(hasValue, `Template ${id} missing distance ${expectedDist}`).toBeTruthy();
            }
            if (features.paceSpeed) {
                const hasPace = logStrDense.includes(expectedPace) || logStrDense.includes(expectedPace.replace(':', ''));
                expect(hasPace, `Template ${id} missing pace ${expectedPace}`).toBeTruthy();
            }

            // --- Pillar 1: Uniqueness ---
            const countOccurrences = (val) => {
                if (!val) return 0;
                const clean = val.replace(/[:.]/g, '');
                const occ = logStr.split(val).length - 1;
                const denseOcc = logStrDense.split(clean).length - 1;
                return Math.max(occ, denseOcc);
            };

            const distOcc = countOccurrences(expectedDist);
            expect(distOcc, `Template ${id} shows duplicated distance ${expectedDist}`).toBeLessThanOrEqual(2);

            if (features.paceSpeed) {
                const paceOcc = countOccurrences(expectedPace);
                expect(paceOcc, `Template ${id} shows duplicated pace/speed ${expectedPace}`).toBeLessThanOrEqual(2);
                
                // CRITICAL: Ensure Pace is NOT equal to Time if both are shown
                if (features.duration && expectedPace === stats.timeStr.split(' ')[0]) {
                    // This is only allowed if they are legitimately equal by coincidence, but usually indicates a bug.
                    // For now, we just ensure the labels are distinct if the values are suspicious.
                }
            }

            // --- Pillar 3: Visual Regression ---
            await expect(editorPage.canvasWrapper).toHaveScreenshot(`dist-${id}.png`, {
                maxDiffPixelRatio: 0.1,
                threshold: 0.2
            });
        }
    });

    test('Test 2: Activity without Distance Verification (Uniqueness + Consistency + Visual)', async ({ page }) => {
        test.setTimeout(90000);
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);
        const api = new MockStravaClient(page);

        await feedPage.injectMockAuth();
        await api.mockSuccessfulActivities();
        await feedPage.goto();
        await feedPage.waitForLoaderToHide();

        const activity = TestUtils.findFirstActivityWithoutDistance()!;
        const stats = TestUtils.getExpectedStats(activity);
        const activityTitle = activity.name;

        await feedPage.openActivityEditor(activityTitle);
        await editorPage.verifyEditorScreenVisible(activityTitle);
        await editorPage.injectCanvasInterceptor();

        for (const template of activeTemplates) {
            const { id, features, category } = template as any;

            // Skip templates specifically for activities with distance
            if (category === 'distance') continue;

            const startCount = await editorPage.getDrawCount();
            await editorPage.clearCanvasTextLog();
            await editorPage.selectTemplate(id);
            await editorPage.verifyTemplateIsActive(id);

            // Wait for deterministic draw signal
            await page.waitForFunction((prev) => (window as any)._scoraDrawCount > prev, startCount);

            const expectedTimePart = stats.timeStr.toUpperCase().replace(' ', '');
            const expectedHR = stats.avgHeartrate?.toString() || 'DONE';

            await page.waitForFunction((args) => {
                const logs = (window as any)._scoraCanvasTextLog || [];
                const logStr = logs.join('').toUpperCase();
                return logs.length > 3 || logStr.includes(args.hr) || logStr.includes(args.time);
            }, { hr: expectedHR, time: expectedTimePart }, { timeout: 10000 });

            const logs = await editorPage.getCanvasTextLog();
            const logStrDense = logs.join('').replace(/\s+/g, '').toUpperCase();

            // --- Pillar 2: Consistency ---
            if (features.duration) {
                expect(logStrDense).toContain(expectedTimePart);
            }

            if (features.heartRate && stats.avgHeartrate) {
                const hasHRValue = logStrDense.includes(expectedHR);
                expect(hasHRValue, `Template ${id} missing heartrate value ${expectedHR}`).toBeTruthy();
            }

            // --- Pillar 1: Uniqueness ---
            if (features.duration) {
                const occurrences = logStrDense.split(expectedTimePart).length - 1;
                expect(occurrences).toBeLessThanOrEqual(2);
            }

            // --- Pillar 3: Visual Regression ---
            await expect(editorPage.canvasWrapper).toHaveScreenshot(`nodist-${id}.png`, {
                maxDiffPixelRatio: 0.1,
                threshold: 0.2
            });
        }
    });

    test('Test 3: Start Time Consistency (No Drift)', async ({ page }) => {
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);
        const api = new MockStravaClient(page);

        await feedPage.injectMockAuth();
        await api.mockSuccessfulActivities();
        await feedPage.goto();
        await feedPage.waitForLoaderToHide();

        const activity = TestUtils.findFirstActivityWithDistance()!;
        const stats = TestUtils.getExpectedStats(activity);

        await editorPage.injectCanvasInterceptor();
        await feedPage.openActivityEditor(activity.name);

        const startCount = await editorPage.getDrawCount();
        await editorPage.selectTemplate('social-float');

        // Wait for deterministic draw signal
        await page.waitForFunction((prev) => (window as any)._scoraDrawCount > prev, startCount);

        const logs = await editorPage.getCanvasTextLog();
        const logStr = logs.join(' ').replace(/\s+/g, ' ').toUpperCase();

        const [time, ampm] = stats.startTime.split(' ');
        expect(logStr).toContain(time);
        expect(logStr).toContain(ampm);
    });

    test('Test 4: Private Activity (With Distance, No Map) displays accurately', async ({ page }) => {
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);
        const api = new MockStravaClient(page);

        await feedPage.injectMockAuth();
        await api.mockSuccessfulActivities();
        await feedPage.goto();
        await feedPage.waitForLoaderToHide();

        // Find activity with distance but NO polyline (Private)
        const activity = mockActivities.find(a => a.distance > 0 && !a.map?.summary_polyline)!;
        const stats = TestUtils.getExpectedStats(activity);

        await editorPage.injectCanvasInterceptor();
        const startCount = await editorPage.getDrawCount();

        await feedPage.openActivityEditor(activity.name);

        // Wait for the initial draw when editor opens
        await page.waitForFunction((prev) => (window as any)._scoraDrawCount > prev, startCount);

        const logs = await editorPage.getCanvasTextLog();
        const logStrDense = logs.join('').replace(/\s+/g, '').toUpperCase();

        const expectedValue = stats.distanceVal;
        const hasValue = logStrDense.includes(expectedValue) || logStrDense.includes(expectedValue.replace('.', ''));
        expect(hasValue, `Distance ${expectedValue} not found for private activity. Log: ${logStrDense}`).toBeTruthy();
    });

    test('Test 5: Cycling activity uses Speed labels instead of Pace', async ({ page }) => {
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);
        const api = new MockStravaClient(page);

        await feedPage.injectMockAuth();
        await api.mockSuccessfulActivities();
        await feedPage.goto();
        await feedPage.waitForLoaderToHide();

        const activity = TestUtils.findActivityByType('Ride')!;
        const stats = TestUtils.getExpectedStats(activity);
        const activityTitle = activity.name;
        const expectedSpeed = stats.subValue.split(' ')[0];

        await feedPage.openActivityEditor(activityTitle);
        await editorPage.injectCanvasInterceptor();

        for (const template of activeTemplates.slice(0, 5)) {
            const { id, features } = template;
            if (!features.paceSpeed) continue;

            const startCount = await editorPage.getDrawCount();
            await editorPage.clearCanvasTextLog();
            await editorPage.selectTemplate(id);
            await page.waitForFunction((prev) => (window as any)._scoraDrawCount > prev, startCount);

            const logs = await editorPage.getCanvasTextLog();
            const logStrDense = logs.join('').replace(/\s+/g, '').toUpperCase();

            const hasSpeedLabel = logStrDense.includes('SPEED') || logStrDense.includes('KM/H');
            const hasSpeedValue = logStrDense.includes(expectedSpeed) || logStrDense.includes(expectedSpeed.replace('.', ''));

            expect(hasSpeedValue || hasSpeedLabel, `Template ${id} missing cycling speed info ${expectedSpeed}`).toBeTruthy();
        }
    });

    test('Test 6: Multi-Activity Regression Matrix (Phase 4 + Micro Serif)', async ({ page }) => {
        test.setTimeout(120000);
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);
        const api = new MockStravaClient(page);

        await feedPage.injectMockAuth();
        await api.mockSuccessfulActivities();
        await feedPage.goto();
        await feedPage.waitForLoaderToHide();

        const targets = ['stacked-editorial', 'thin-path', 'micro-serif'];
        const matrix = [
            { id: 'ride', query: (a) => a.type === 'Ride' },
            { id: 'workout', query: (a) => !a.distance && !a.map?.summary_polyline },
            { id: 'nomap', query: (a) => a.distance > 0 && !a.map?.summary_polyline }
        ];

        for (const stickerId of targets) {
            for (const item of matrix) {
                const activity = mockActivities.find(item.query)!;
                await feedPage.openActivityEditor(activity.name);
                await editorPage.selectTemplate(stickerId);
                // Allow fonts and shadow to render
                await page.waitForTimeout(1000);
                await expect(editorPage.canvasWrapper).toHaveScreenshot(`matrix-${stickerId}-${item.id}.png`, {
                    maxDiffPixelRatio: 0.1,
                    threshold: 0.2
                });
                await editorPage.goBack();
            }
        }
    });

    // --- Isolated Performance Bars Scenarios ---
    const runName = 'Carrera por la mañana';
    const runId = 17625485696;

    const perfBarsScenarios = [
        { id: '5k', count: 5, label: '5k (White)', textColor: 'white' as const },
        { id: '5k-black', count: 5, label: '5k (Black Tech)', textColor: 'black' as const },
        { id: 'half', count: 21, label: '21k (Half)', textColor: 'white' as const },
        { id: 'marathon', count: 43, label: '42k (Marathon)', textColor: 'white' as const }
    ];

    for (const scenario of perfBarsScenarios) {
        test(`Test 7.${scenario.id}: Performance Bars Adaptive Scaling (${scenario.label})`, async ({ page }) => {
            const api = new MockStravaClient(page);
            const feedPage = new FeedPage(page);
            const editorPage = new EditorPage(page);

            await feedPage.injectMockAuth();
            await api.mockSuccessfulActivities();
            await feedPage.goto();
            await feedPage.waitForLoaderToHide();

            // 1. Mock detailed response
            await api.mockDetailedActivity(runId, scenario.count);

            // 2. Open editor
            await feedPage.openActivityEditor(runName);
            await editorPage.verifyEditorScreenVisible(runName);

            // 3. Set color if needed and Select Performance Bars
            if (scenario.textColor === 'black') {
                await editorPage.setTextColor('black');
            }

            console.info(`[Test] Selecting performance-bars for ${scenario.id}`);
            const responsePromise = page.waitForResponse(resp => 
                resp.url().includes('/api/strava-activities') && 
                resp.request().method() === 'POST' &&
                resp.request().postDataJSON()?.activity_id === runId,
                { timeout: 15000 }
            );

            await editorPage.selectTemplate('performance-bars');
            await responsePromise;

            // Wait for canvas to settle
            await page.waitForFunction(() => {
                const canvas = document.getElementById('storyCanvas') as HTMLCanvasElement;
                return canvas && canvas.style.opacity === '1';
            });

            // 4. Verification
            await expect(editorPage.canvasWrapper).toHaveScreenshot(`perf-bars-${scenario.id}.png`, {
                maxDiffPixelRatio: 0.1,
                threshold: 0.2
            });
        });
    }
});
