import { test, expect } from '@playwright/test';
import { FeedPage } from '../pages/FeedPage';
import { EditorPage } from '../pages/EditorPage';
import { MockStravaClient } from '../utils/MockStravaClient';
import { TestUtils } from '../utils/TestUtils';
import { spellNumber } from '../../../src/utils/formatters';
import { TEMPLATE_REGISTRY } from '../../../src/features/editor/TemplateManager';

/**
 * Registry data scan — paints against sticker-capabilities.json (display contract).
 *
 * Metrics are asserted according to their `display` form:
 *   numeric   → formatted number in fillText log
 *   spelled   → number words (spellNumber) in fillText log
 *   segments  → value is bar/LED digits (not fillText); only require a settled paint
 *   glyphs    → value is glass glyphs (offscreen fillText); only require a settled paint
 *
 * Soft assertions so one bad sticker does not hide the rest of the report.
 * Visual goldens live in registry_hero_visual.spec.ts (fixed hero set).
 */

const ACTIVE_TEMPLATES = TEMPLATE_REGISTRY.filter(t => !t.hidden && t.id !== 'custom');
test.use({ trace: 'off' });

test.describe('Scora App UI: Registry data contracts [ @regression ]', () => {

    test.beforeEach(async ({ page }) => {
        const feedPage = new FeedPage(page);
        const api = new MockStravaClient(page);
        await feedPage.injectMockAuth();
        await api.mockSuccessfulActivities();
        await feedPage.goto();
        await feedPage.waitForLoaderToHide();
    });

    test('Registry: every active template paints its claimed metrics', async ({ page }, testInfo) => {
        test.setTimeout(300000);
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);

        await page.waitForLoadState('networkidle');
        await page.evaluate(() => document.fonts.ready);

        const runTemplates = ACTIVE_TEMPLATES.filter(t => t.category === 'all' || t.category === 'distance');
        const gymTemplates = ACTIVE_TEMPLATES.filter(t => t.category === 'workout');
        const bikeTemplates = ACTIVE_TEMPLATES.filter(t => t.category === 'map');

        const mismatches: string[] = [];

        async function scanTemplates(templates: typeof ACTIVE_TEMPLATES, activityType: 'run' | 'workout' | 'bike') {
            if (templates.length === 0) return;

            let activity;
            if (activityType === 'workout') {
                activity = TestUtils.findFirstActivityWithoutDistance()!;
            } else {
                activity = (TestUtils as any).findFirstActivityWithMap ?
                    TestUtils.findFirstActivityWithMap() :
                    TestUtils.findActivityByType('Run');
            }

            await feedPage.openActivityEditor(activity.name);
            await editorPage.injectCanvasInterceptor();

            for (const template of templates) {
                const { id } = template;
                await editorPage.clearCanvasTextLog();

                await editorPage.selectTemplate(id);
                await page.evaluate(() => document.fonts.ready);
                await editorPage.waitForDrawSettled();
                await page.waitForTimeout(500);

                const logs = await editorPage.getCanvasTextLog();
                const normalizedLogs = TestUtils.normalizeForCanvas(logs.join(' '));
                const truth = TestUtils.getStickerTruth(id, activityType);
                const expected = TestUtils.getExpectedStats(activity);

                const fail = (msg: string) => {
                    mismatches.push(`${id}/${activityType}: ${msg} | log=${normalizedLogs}`);
                    expect.soft(false, `${id}/${activityType}: ${msg}`).toBe(true);
                };

                for (const metric of truth.metrics) {
                    const form = truth.display[metric] || 'numeric';

                    if (metric === 'distance') {
                        if (form === 'segments' || form === 'glyphs') {
                            // Value is not fillText — require the sticker painted something.
                            if (!normalizedLogs) fail(`distance (${form}) produced no canvas text`);
                            continue;
                        }
                        const distVal = TestUtils.normalizeForCanvas(expected.distanceVal).replace(/[A-RT-Z]/g, '');
                        const needle = form === 'spelled'
                            ? TestUtils.normalizeForCanvas(spellNumber(parseFloat(expected.distanceVal) || 0))
                            : distVal;
                        if (!normalizedLogs.includes(needle)) fail(`distance "${needle}" missing (${form})`);
                    }
                    if (metric === 'heartRate') {
                        const isMax = truth.metadata.includes('MAX_HR');
                        const targetHR = isMax ? expected.maxHeartrate : expected.avgHeartrate;
                        if (form === 'segments' || form === 'glyphs') {
                            if (!normalizedLogs) fail(`heartRate (${form}) produced no canvas text`);
                            continue;
                        }
                        if (!normalizedLogs.includes(String(targetHR))) fail(`BPM "${targetHR}" missing (${form})`);
                    }
                    if (metric === 'time') {
                        if (form === 'segments' || form === 'glyphs') {
                            if (!normalizedLogs) fail(`time (${form}) produced no canvas text`);
                            continue;
                        }
                        const timeVal = TestUtils.normalizeForCanvas(expected.timeStr);
                        const needle = form === 'spelled'
                            ? TestUtils.normalizeForCanvas(spellNumber(parseFloat(expected.timeStr) || 0))
                            : timeVal;
                        if (!normalizedLogs.includes(needle)) fail(`Time "${needle}" missing (${form})`);
                    }
                }
            }

            await editorPage.goBack();
            await feedPage.waitForLoaderToHide();
        }

        await scanTemplates(runTemplates, 'run');
        await scanTemplates(gymTemplates, 'workout');
        await scanTemplates(bikeTemplates, 'bike');

        if (mismatches.length) {
            console.log(`\n=== PAINT CONTRACT MISMATCHES (${mismatches.length}) ===`);
            for (const m of mismatches) console.log(' •', m);
            await testInfo.attach('paint-contract-mismatches.txt', {
                body: mismatches.join('\n'),
                contentType: 'text/plain',
            });
        }
    });

});
