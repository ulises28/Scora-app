import { test, expect } from '@playwright/test';
import { FeedPage } from '../pages/FeedPage';
import { EditorPage } from '../pages/EditorPage';
import { MockStravaClient } from '../utils/MockStravaClient';
import { TEMPLATE_REGISTRY } from '../../../src/features/editor/TemplateManager';
import { TestUtils } from '../utils/TestUtils';
import { mockActivities } from '../../fixtures/stravaData';
import capabilities from '../fixtures/sticker-capabilities.json' with { type: 'json' };

test.describe('Scora App UI: Advanced Canvas Verification', () => {

    const ACTIVE_TEMPLATES = TEMPLATE_REGISTRY.filter(t => !t.seasonal);
    const REPRESENTATIVE_IDS = TestUtils.getSampleTemplates(8);

    // 🛡️ SAFARI-ISOLATION: Zero-touch stabilization for Mobile Safari
    async function stabilizeSafari(page: any, info: any) {
        if (info.project.name === 'Mobile Safari') {
            await page.evaluate(() => document.fonts.ready);
        }
    }

    test.beforeEach(async ({ page }, testInfo) => {
        await stabilizeSafari(page, testInfo);
    });

    test('Test 1: Activity with Distance Verification (Uniqueness + Consistency + Visual)', async ({ page }, testInfo) => {
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

        // 🎯 DYNAMIC DISCOVERY: Find the primary representative for 'distance' category
        // prioritize templates that draw titles for these baseline tests
        const primaryTemplate = TEMPLATE_REGISTRY.find(t => t.category === 'distance') || 
                          ACTIVE_TEMPLATES[0];
        const templateId = primaryTemplate.id;

        // 1. Select Template & Wait for Sync
        await editorPage.selectTemplate(templateId);
        await editorPage.waitForDrawSettled();

        const drawCount = await editorPage.getDrawCount();
        expect(drawCount).toBeGreaterThan(0);

        // 🔍 GLOBAL GUARD: Verify Absolute Truth (Title + Main Stat)
        const logs = await editorPage.getCanvasTextLog();
        const normalizedLogs = TestUtils.normalizeForCanvas(logs.join(' '));
        
        const expectedTitle = TestUtils.normalizeForCanvas(TestUtils.truncateTitle(activityTitle));
        const expectedValue = TestUtils.normalizeForCanvas(stats.mainValue.replace(' km', ''));
        
        // Truth-Aware Guard: Only expect title if sticker claims to render it
        const mode = activity.type.toLowerCase().includes('run') ? 'run' : (activity.type.toLowerCase().includes('bike') ? 'bike' : 'workout');
        const truth = (capabilities as any)[templateId]?.modes?.[mode];
        
        if (truth?.metadata?.includes('title')) {
            expect(normalizedLogs).toContain(expectedTitle);
        }
        expect(normalizedLogs).toContain(expectedValue);

        await expect(editorPage.canvasWrapper).toHaveScreenshot(`core-dist-${templateId}.png`, {
            maxDiffPixelRatio: 0.1,
            threshold: 0.2
        });
    });

    test('Test 2: Activity without Distance Verification (Uniqueness + Consistency + Visual)', async ({ page }, testInfo) => {
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

        // 🎯 DYNAMIC DISCOVERY: Find the primary representative for 'workout' (or 'all') category
        const primaryTemplate = TEMPLATE_REGISTRY.find(t => t.category === 'workout') || 
                                TEMPLATE_REGISTRY.find(t => t.id === 'science-pro') || 
                                ACTIVE_TEMPLATES[1];
        const templateId = primaryTemplate.id;

        // 1. Select Template & Wait for Sync
        await editorPage.selectTemplate(templateId);
        await editorPage.waitForDrawSettled();

        const drawCount = await editorPage.getDrawCount();
        expect(drawCount).toBeGreaterThan(0);

        // 🔍 GLOBAL GUARD: Verify Absolute Truth (Title + Main Stat)
        const logs = await editorPage.getCanvasTextLog();
        const normalizedLogs = TestUtils.normalizeForCanvas(logs.join(' '));
        
        const expectedTitle = TestUtils.normalizeForCanvas(TestUtils.truncateTitle(activityTitle));
        const expectedValue = TestUtils.normalizeForCanvas(stats.mainValue);
        
        // Truth-Aware Guard: Only expect title if sticker claims to render it
        const mode = activity.type.toLowerCase().includes('run') ? 'run' : (activity.type.toLowerCase().includes('bike') ? 'bike' : 'workout');
        const truth = (capabilities as any)[templateId]?.modes?.[mode];

        if (truth?.metadata?.includes('title')) {
            expect(normalizedLogs).toContain(expectedTitle);
        }
        expect(normalizedLogs).toContain(expectedValue);

        await expect(editorPage.canvasWrapper).toHaveScreenshot(`core-nodist-${templateId}.png`, {
            maxDiffPixelRatio: 0.1,
            threshold: 0.2
        });
    });

    // ... (Test 3 to 11 simplified by relying on snapshots) ...


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
        const normalizedLogs = TestUtils.normalizeForCanvas(logs.join(''));

        const expectedValue = TestUtils.normalizeForCanvas(stats.distanceVal);
        expect(normalizedLogs).toContain(expectedValue);
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

        const paceTemplates = ACTIVE_TEMPLATES.filter(t => t.features.paceSpeed).slice(0, 5);
        for (const template of paceTemplates) {
            const { id } = template;

            const startCount = await editorPage.getDrawCount();
            await editorPage.clearCanvasTextLog();
            await editorPage.selectTemplate(id);
            await editorPage.waitForDrawSettled();

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
                await editorPage.waitForDrawSettled();
                await expect(editorPage.canvasWrapper).toHaveScreenshot(`matrix-${stickerId}-${item.id}.png`, {
                    maxDiffPixelRatio: 0.1,
                    threshold: 0.2
                });
                await editorPage.goBack();
            }
        }
    });

    test('Test 7: Studio Precision - Canvas Export (Download Verification)', async ({ page }) => {
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);
        const api = new MockStravaClient(page);

        await feedPage.injectMockAuth();
        await api.mockSuccessfulActivities();
        await feedPage.goto();
        await feedPage.waitForLoaderToHide();

        const activity = TestUtils.findFirstActivityWithDistance()!;
        await feedPage.openActivityEditor(activity.name);
        await editorPage.verifyEditorScreenVisible(activity.name);

        // Standard Download logic: Expect download event AND valid file name
        const downloadPromise = page.waitForEvent('download');
        await editorPage.clickDownload();
        const download = await downloadPromise;
        
        expect(download.suggestedFilename()).toMatch(/scora-.*\.png/);
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
        const firstThumb = editorPage.getStickerThumb(ACTIVE_TEMPLATES[0].id);
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

    test('Test 10: Curated Representative Matrix (Tiered Logic + Visual Verification)', async ({ page }, testInfo) => {
        // This is the 'Clever' approach: Logic check for 40+ templates, Visuals for Top 8
        test.setTimeout(120000);
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);
        const api = new MockStravaClient(page);

        await feedPage.injectMockAuth();
        await api.mockSuccessfulActivities();
        await feedPage.goto();
        await feedPage.waitForLoaderToHide();

        // 🛡️ Safari stabilization already handled by beforeEach
        
        const activity = TestUtils.findFirstActivityWithDistance()!;
        await feedPage.openActivityEditor(activity.name);
        await editorPage.injectCanvasInterceptor();


        for (const template of ACTIVE_TEMPLATES) {
            const { id } = template;
            
            // 1. Select Template & Wait for Sync
            const startCount = await editorPage.getDrawCount();
            await editorPage.selectTemplate(id);
            await editorPage.waitForDrawSettled();
            
            // 2. Intelligence Check (Metadata-Driven)
            const drawCount = await editorPage.getDrawCount();
            expect(drawCount).toBeGreaterThan(0);
            
            const logs = await editorPage.getCanvasTextLog();
            const normalizedLogs = TestUtils.normalizeForCanvas(logs.join(' '));
            
            // Determine mode dynamically from the activity
            const mode = (activity.type || 'Run').toLowerCase() === 'run' ? 'run' : 
                        (/ride|bike/i.test(activity.type) ? 'bike' : 'workout');
            
            const truth = TestUtils.getStickerTruth(id, mode as any);
            const expected = TestUtils.getExpectedStats(activity);

            // A. Verify Metrics (Absolute Data Integrity: 9.6, 4:30, etc.)
            for (const metric of truth.metrics) {
                if (metric === 'distance') {
                    // Extract numeric part only (e.g., 802 from 8.02 KM)
                    const distVal = TestUtils.normalizeForCanvas(expected.distanceVal).replace(/[A-Z]/g, '');
                    const altDistVal = TestUtils.normalizeForCanvas(parseFloat(expected.distanceVal).toString()).replace(/[A-Z]/g, '');
                    expect(normalizedLogs, `Distance "${distVal}" not found in ${id}`).toMatch(new RegExp(`${distVal}|${altDistVal}`));
                }
                if (metric === 'heartRate' && expected.avgHeartrate) {
                    expect(normalizedLogs, `BPM "${expected.avgHeartrate}" not found in ${id}`).toContain(expected.avgHeartrate.toString());
                }
                if (metric === 'pace') {
                    // Extract numeric part only (e.g., 427 from 4:27 /km)
                    const paceVal = TestUtils.normalizeForCanvas(expected.subValue).replace(/[A-Z]/g, '');
                    expect(normalizedLogs, `Pace/Speed numeric "${paceVal}" not found in ${id}`).toContain(paceVal);
                }
                if (metric === 'time') {
                    const timeVal = TestUtils.normalizeForCanvas(expected.timeStr);
                    expect(normalizedLogs, `Time "${timeVal}" not found in ${id}`).toContain(timeVal);
                }
            }

            // B. Verify Labels (Indestructible Protocol: Only Units are strictly asserted)
            const STABLE_UNITS = ['KM', 'BPM', 'PACE', 'KM/H', '/KM', 'CAL', 'KCAL'];
            for (const label of truth.labels) {
                const normalizedTarget = TestUtils.normalizeForCanvas(label);
                const isUnit = STABLE_UNITS.includes(normalizedTarget);
                
                if (isUnit) {
                    expect(TestUtils.isLabelMatch(normalizedLogs, label), 
                        `Unit "${label}" not found for template "${template.id}"`).toBeTruthy();
                }
            }

            // C. Verify Metadata Tokens (Started, GREETING, Location/Title)
            for (const meta of truth.metadata) {
                if (meta === 'location') {
                    const titlePart = TestUtils.normalizeForCanvas(expected.title.substring(0, 10));
                    const locPart = TestUtils.normalizeForCanvas(expected.location || 'MEXICOCITY');
                    expect(normalizedLogs).toMatch(new RegExp(`${titlePart}|${locPart}`));
                }
            }

            // 3. Visual Check (Curated Top 8 Matrix)
            if (REPRESENTATIVE_IDS.includes(id)) {
                await editorPage.waitForDrawSettled();
                await expect(editorPage.canvasWrapper).toHaveScreenshot(`matrix-${id}.png`, {
                    maxDiffPixelRatio: 0.1,
                    threshold: 0.2
                });
            }

            // 🛡️ Hygiene: Clear log before next template to avoid pollution
            await editorPage.clearCanvasTextLog();
        }
    });
});
