import { test, expect } from '@playwright/test';
import { FeedPage } from '../pages/FeedPage';
import { EditorPage } from '../pages/EditorPage';
import { MockStravaClient } from '../utils/MockStravaClient';
import { TestUtils } from '../utils/TestUtils';
import { TEMPLATE_REGISTRY } from '../../../src/features/editor/TemplateManager';

// 🔍 ARCHITECT RULE: 100% Discovery-Driven.
const ACTIVE_TEMPLATES = TEMPLATE_REGISTRY.filter(t => !t.hidden && t.id !== 'custom');
test.use({ trace: 'off' }); // 🚀 Memory Opt: Traces for 40+ stickers are too heavy for Docker

test.describe('Scora App UI: Registry Integrity (Deep Regression) [ @regression ]', () => {

    test.beforeEach(async ({ page }) => {
        const feedPage = new FeedPage(page);
        const api = new MockStravaClient(page);
        await feedPage.injectMockAuth();
        await api.mockSuccessfulActivities();
        await feedPage.goto();
        await feedPage.waitForLoaderToHide();
    });

    /**
     * TEST 10: Unified Sticker Integrity Engine
     * Dynamically iterates through the entire registry.
     * Treats the first 5 records as 'Hero' stickers for visual regression.
     */
    test('Registry: Exhaustive quality scan of all registered templates for data integrity', async ({ page }) => {
        test.setTimeout(300000); // 5 minutes for full scan
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);

        await page.waitForLoadState('networkidle');
        await page.evaluate(() => document.fonts.ready);
        
        // Group templates by their category to ensure they are rendered with the correct activity type
        const runTemplates = ACTIVE_TEMPLATES.filter(t => t.category === 'all' || t.category === 'distance');
        const gymTemplates = ACTIVE_TEMPLATES.filter(t => t.category === 'workout');
        const bikeTemplates = ACTIVE_TEMPLATES.filter(t => t.category === 'map');

        // Establish 'Hero' set dynamically (Top 5 based on registry order)
        const heroIds = ACTIVE_TEMPLATES.slice(0, 5).map(t => t.id);

        async function scanTemplates(templates: typeof ACTIVE_TEMPLATES, activityType: 'run' | 'workout' | 'bike') {
            if (templates.length === 0) return;

            let activity;
            if (activityType === 'workout') {
                activity = TestUtils.findFirstActivityWithoutDistance()!;
            } else {
                // For 'run' and 'bike', any activity with both distance AND a map will unlock ALL distance/map templates.
                activity = (TestUtils as any).findFirstActivityWithMap ? 
                           TestUtils.findFirstActivityWithMap() : 
                           TestUtils.findActivityByType('Run');
            }

            await feedPage.openActivityEditor(activity.name);
            await editorPage.injectCanvasInterceptor();

            for (const template of templates) {
                const { id } = template;
                
                // 🛡️ FRESH SLATE: Prevent text accumulation from previous stickers
                console.log("Scanning template:", id);
                await editorPage.clearCanvasTextLog();
                
                await editorPage.selectTemplate(id);
                await page.evaluate(() => document.fonts.ready); // Ensure font rendering is settled
                await editorPage.waitForDrawSettled();
                await page.waitForTimeout(500); // 🏁 Studio Cooldown: Prevent canvas flickering
                
                const logs = await editorPage.getCanvasTextLog();
                const normalizedLogs = TestUtils.normalizeForCanvas(logs.join(' '));
                
                const truth = TestUtils.getStickerTruth(id, activityType);
                const expected = TestUtils.getExpectedStats(activity);

                // [A] DATA ENGINE: Verify numeric and units
                for (const metric of truth.metrics) {
                    if (metric === 'distance') {
                        const distVal = TestUtils.normalizeForCanvas(expected.distanceVal).replace(/[A-RT-Z]/g, '');
                        expect(normalizedLogs, `${id}: Distance "${distVal}" missing`).toContain(distVal);
                    }
                    if (metric === 'heartRate') {
                        const isMax = truth.metadata.includes('MAX_HR');
                        const targetHR = isMax ? expected.maxHeartrate : expected.avgHeartrate;
                        expect(normalizedLogs, `${id}: BPM "${targetHR}" missing`).toContain(targetHR.toString());
                    }
                    if (metric === 'time') {
                        const timeVal = TestUtils.normalizeForCanvas(expected.timeStr);
                        expect(normalizedLogs, `${id}: Time "${timeVal}" missing`).toContain(timeVal);
                    }
                }

                // [B] VISUAL ENGINE: Capture Hero quality for the Top 5
                if (heroIds.includes(id)) {
                    await expect(editorPage.canvasWrapper).toHaveScreenshot(`hero-v3-${id}.png`, {
                        threshold: 0.35, // Relaxed for Vercel/Vite variance
                        maxDiffPixelRatio: 0.15
                    });
                }
            }
            
            // Go back to feed for the next group
            await editorPage.goBack();
            await feedPage.waitForLoaderToHide();
        }

        await scanTemplates(runTemplates, 'run');
        await scanTemplates(gymTemplates, 'workout');
        await scanTemplates(bikeTemplates, 'bike');
    });

});
