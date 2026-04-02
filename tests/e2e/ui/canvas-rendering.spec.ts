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
        // Increase timeout for the large template matrix (40+ templates)
        test.setTimeout(120000);

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
        
        await feedPage.openActivityEditor(activityTitle, stats.mainValue);
        await editorPage.verifyEditorScreenVisible(activityTitle);
        await editorPage.injectCanvasInterceptor();

        // Ensure fonts are ready ONCE before the matrix begins
        await page.waitForLoadState('networkidle');
        await page.evaluate(() => document.fonts.ready);

        const lastTemplateId = activeTemplates[activeTemplates.length - 1].id;
        await editorPage.selectTemplate(lastTemplateId);
        await page.waitForTimeout(500);

        for (const template of activeTemplates) {
            const { id, features, category, compact } = template;

            // Skip templates specifically for activities without distance
            if (category === 'workout') continue;

            // Wait a tiny bit for the template to initialize 
            await page.waitForTimeout(50);

            const startCount = await editorPage.getDrawCount();
            await editorPage.clearCanvasTextLog();
            await editorPage.selectTemplate(id);
            await editorPage.verifyTemplateIsActive(id);

            // Wait for deterministic draw signal
            await page.waitForFunction((prev) => (window as any)._scoraDrawCount > prev, startCount);

            const logs = await editorPage.getCanvasTextLog();
            const logStr = logs.join(' ').replace(/\s+/g, ' ').toUpperCase();
            const logStrDense = logs.join('').replace(/\s+/g, '').toUpperCase();

            // --- Feature-Aware Dynamic Assertions ---
            const distEnabled = !!features.distance && stats.hasDistance;
            const durEnabled = !!features.duration && (!compact || !stats.hasDistance);
            const paceEnabled = !!features.paceSpeed && stats.hasDistance;
            const hrEnabled = !!features.heartRate && (!compact || !stats.hasDistance);

            if (distEnabled) {
                expect(logStrDense.includes(stats.distanceVal), `Template ${id} missing distance ${stats.distanceVal}`).toBeTruthy();
            }

            if (paceEnabled) {
                const paceVal = stats.subValue.split(' ')[0];
                const hasPace = logStrDense.includes(paceVal) || logStrDense.includes(paceVal.replace(':', ''));
                expect(hasPace, `Template ${id} missing pace/speed ${paceVal}`).toBeTruthy();
            }

            if (durEnabled) {
                const timePart = stats.timeStr.toUpperCase().replace(/\s+/g, '');
                expect(logStrDense.includes(timePart), `Template ${id} missing duration ${stats.timeStr}`).toBeTruthy();
            }

            if (hrEnabled) {
                const hrMax = (stats.maxHeartrate || '').toString();
                const hrAvg = (stats.avgHeartrate || '').toString();
                if (hrMax || hrAvg) {
                    const found = (hrMax && logStrDense.includes(hrMax)) || (hrAvg && logStrDense.includes(hrAvg));
                    expect(found, `Template ${id} missing heartrate (looked for max: ${hrMax}, avg: ${hrAvg})`).toBeTruthy();
                }
            }

            if (id === 'serif-float') {
                const tag = stats.hasDistance ? 'DISTANCE' : 'TIME';
                expect(logStr.includes(tag), `Serif Float missing "${tag}" tagline`).toBeTruthy();
            }

            // --- Pillar 3: Visual Regression ---
            await expect(editorPage.canvasWrapper).toHaveScreenshot(`dist-${id}.png`, {
                maxDiffPixelRatio: 0.1,
                threshold: 0.2
            });
        }
    });

    test('Test 2: Activity without Distance Verification (Uniqueness + Consistency + Visual)', async ({ page }) => {
        // Increase timeout for the matrix
        test.setTimeout(120000);
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

        await feedPage.openActivityEditor(activityTitle, stats.mainValue);
        await editorPage.verifyEditorScreenVisible(activityTitle);
        await editorPage.injectCanvasInterceptor();

        // Ensure fonts are ready ONCE
        await page.waitForLoadState('networkidle');
        await page.evaluate(() => document.fonts.ready);

        const lastTemplateId = activeTemplates[activeTemplates.length - 1].id;
        await editorPage.selectTemplate(lastTemplateId);
        await page.waitForTimeout(500);

        for (const template of activeTemplates) {
            const { id, features, category, compact } = template;

            // Skip templates specifically for activities with distance
            if (category === 'distance') continue;

            // Wait a tiny bit for the template to initialize 
            await page.waitForTimeout(50);

            const startCount = await editorPage.getDrawCount();
            await editorPage.clearCanvasTextLog();
            await editorPage.selectTemplate(id);
            await editorPage.verifyTemplateIsActive(id);

            // Wait for deterministic draw signal
            await page.waitForFunction((prev) => (window as any)._scoraDrawCount > prev, startCount);

            const logs = await editorPage.getCanvasTextLog();
            const logStrDense = logs.join('').replace(/\s+/g, '').toUpperCase();

            // --- Feature-Aware Dynamic Assertions ---
            const distEnabled = !!features.distance && stats.hasDistance;
            const durEnabled = !!features.duration && (!compact || !stats.hasDistance);
            const paceEnabled = !!features.paceSpeed && stats.hasDistance;
            const hrEnabled = !!features.heartRate && (!compact || !stats.hasDistance);

            if (distEnabled) {
                expect(logStrDense.includes(stats.distanceVal), `Template ${id} missing distance ${stats.distanceVal}`).toBeTruthy();
            }

            if (durEnabled) {
                const timePart = stats.timeStr.toUpperCase().replace(/\s+/g, '');
                expect(logStrDense.includes(timePart), `Template ${id} missing duration ${stats.timeStr}`).toBeTruthy();
            }

            if (hrEnabled) {
                const hrMax = (stats.maxHeartrate || '').toString();
                const hrAvg = (stats.avgHeartrate || '').toString();
                if (hrMax || hrAvg) {
                    const found = (hrMax && logStrDense.includes(hrMax)) || (hrAvg && logStrDense.includes(hrAvg));
                    expect(found, `Template ${id} missing heartrate (looked for max: ${hrMax}, avg: ${hrAvg})`).toBeTruthy();
                }
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
        await editorPage.selectTemplate('vhs-retro');

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

        await feedPage.openActivityEditor(activityTitle, stats.mainValue);
        await editorPage.injectCanvasInterceptor();

        const paceTemplates = activeTemplates.filter(t => t.features.paceSpeed).slice(0, 5);
        for (const template of paceTemplates) {
            const { id } = template;

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
        // High-stress matrix test
        test.setTimeout(180000);
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);
        const api = new MockStravaClient(page);

        await feedPage.injectMockAuth();
        await api.mockSuccessfulActivities();
        await feedPage.goto();
        await feedPage.waitForLoaderToHide();

        // Ensure fonts are ready ONCE
        await page.waitForLoadState('networkidle');
        await page.evaluate(() => document.fonts.ready);

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


    test('Test 8: Absolute Perfection - One-Tap Copy & Feedback', async ({ page, context }, testInfo) => {
        // Mock Clipboard API for the test environment (Hardened for Safari)
        if (testInfo.project.name !== 'Mobile Safari') {
            await context.grantPermissions(['clipboard-write', 'clipboard-read']).catch(() => {});
        }
        await page.addInitScript(() => {
            const mockClipboard = {
                write: async () => Promise.resolve(),
                writeText: async () => Promise.resolve(),
            };
            
            // Force override even if it exists partially
            Object.defineProperty(navigator, 'clipboard', {
                value: mockClipboard,
                configurable: true,
                writable: true
            });

            if (typeof (window as any).ClipboardItem === 'undefined') {
                (window as any).ClipboardItem = class MockClipboardItem {
                    constructor(data: any) { (this as any).data = data; }
                };
            }
        });

        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);
        const api = new MockStravaClient(page);

        await feedPage.injectMockAuth();
        await api.mockSuccessfulActivities();
        await feedPage.goto();
        await feedPage.waitForLoaderToHide();

        const activity = TestUtils.findFirstActivityWithDistance()!;
        await feedPage.openActivityEditor(activity.name);
        
        // 1. Verify Universal Grid on thumbnails
        const firstThumb = editorPage.getStickerThumb(activeTemplates[0].id);
        await expect(firstThumb).toHaveClass(/transparency-grid/);

        // 2. Click to Copy (Wait for canvas to be ready)
        await page.waitForSelector('#storyCanvas');
        await editorPage.clickCanvasToCopy();
        
        // 3. Verify Feedback pulse/class
        await editorPage.verifyCopyFeedback();
    });

    test('Test 9: Studio Precision - Desktop Navigation Arrows (Viewport Specific)', async ({ page }) => {
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);
        const api = new MockStravaClient(page);

        await feedPage.injectMockAuth();
        await api.mockSuccessfulActivities();
        
        // 1. Check Large Viewport (Desktop)
        await page.setViewportSize({ width: 1200, height: 800 });
        await feedPage.goto();
        await feedPage.waitForLoaderToHide();
        const activity = TestUtils.findFirstActivityWithDistance()!;
        await feedPage.openActivityEditor(activity.name);
        
        await editorPage.verifyDesktopArrowsVisibility(true);

        // 2. Check Small Viewport (Mobile)
        await page.setViewportSize({ width: 375, height: 667 });
        await editorPage.verifyDesktopArrowsVisibility(false);
    });

    test('Test 10: Editorial Strip - Vertical Layout & Weather', async ({ page }) => {
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);
        const api = new MockStravaClient(page);

        await feedPage.injectMockAuth();
        await api.mockSuccessfulActivities();
        await feedPage.goto();
        await feedPage.waitForLoaderToHide();

        await editorPage.injectCanvasInterceptor();
        await feedPage.openActivityEditor(mockActivities[0].name);
        await editorPage.selectTemplate('editorial-strip');

        // Wait for fonts and gradient
        await page.waitForTimeout(1000);
        
        await expect(editorPage.canvasWrapper).toHaveScreenshot('editorial-strip-v3.png', {
            maxDiffPixelRatio: 0.1,
            threshold: 0.2
        });

        const logs = await editorPage.getCanvasTextLog();
        const logStr = logs.join(' ').toUpperCase();
        expect(logStr).toContain('LOCAL TIME');
        expect(logStr).toContain('9:00 AM');
    });

    test('Test 11: Science Pro - Technical HUD & Performance', async ({ page }) => {
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);
        const api = new MockStravaClient(page);

        await feedPage.injectMockAuth();
        await api.mockSuccessfulActivities();
        await feedPage.goto();
        await feedPage.waitForLoaderToHide();

        await editorPage.injectCanvasInterceptor();
        await feedPage.openActivityEditor(mockActivities[0].name);
        await editorPage.selectTemplate('science-pro');

        // Wait for tech circles to draw
        await page.waitForTimeout(1000);
        
        await expect(editorPage.canvasWrapper).toHaveScreenshot('science-pro-v3.png', {
            maxDiffPixelRatio: 0.1,
            threshold: 0.2
        });

        const logs = await editorPage.getCanvasTextLog();
        const logStr = logs.join(' ').toUpperCase();
        expect(logStr).toContain('PERFORMANCE');
        expect(logStr).toContain('TRACKED');
    });
});
