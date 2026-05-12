import { test, expect } from '@playwright/test';
import { FeedPage } from '../pages/FeedPage';
import { EditorPage } from '../pages/EditorPage';
import { MockStravaClient } from '../utils/MockStravaClient';
import { TestUtils } from '../utils/TestUtils';
import { TEMPLATE_REGISTRY } from '../../../src/features/editor/TemplateManager';

// 🔍 ARCHITECT RULE: 100% Discovery-Driven.
const ACTIVE_TEMPLATES = TEMPLATE_REGISTRY.filter(t => !t.hidden && t.id !== 'custom');

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
        
        const activity = TestUtils.findFirstActivityWithDistance()!;
        await feedPage.openActivityEditor(activity.name);
        await editorPage.injectCanvasInterceptor();

        // Establish 'Hero' set dynamically (Top 5 based on registry order)
        const heroIds = ACTIVE_TEMPLATES.slice(0, 5).map(t => t.id);

        for (const template of ACTIVE_TEMPLATES) {
            const { id } = template;
            
            // 🛡️ FRESH SLATE: Prevent text accumulation from previous stickers
            await editorPage.clearCanvasTextLog();
            
            await editorPage.selectTemplate(id);
            await page.evaluate(() => document.fonts.ready); // Ensure font rendering is settled
            await editorPage.waitForDrawSettled();
            await page.waitForTimeout(200); // 🏁 Studio Cooldown: Prevent canvas flickering
            
            const logs = await editorPage.getCanvasTextLog();
            const normalizedLogs = TestUtils.normalizeForCanvas(logs.join(' '));
            const mode = (activity.type || 'Run').toLowerCase() === 'run' ? 'run' : 
                        (/ride|bike/i.test(activity.type) ? 'bike' : 'workout');
            
            const truth = TestUtils.getStickerTruth(id, mode as any);
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
    });

});
