import { test, expect } from '@playwright/test';
import { FeedPage } from '../pages/FeedPage';
import { EditorPage } from '../pages/EditorPage';
import { MockStravaClient } from '../utils/MockStravaClient';
import { TEMPLATE_REGISTRY } from '../../../src/features/editor/TemplateManager';
import { TestUtils } from '../utils/TestUtils';

/**
 * Adaptive selection (distance ↔ duration fallback).
 *
 * Catalog-churn safe: pinned sticker ids, not "first in registry".
 * Data asserts use the display contract; screenshots only via @visual heroes.
 */

const DISTANCE_STICKER_ID = 'studio-precision';
const WORKOUT_STICKER_ID = 'micro-map-pill';

function requireSticker(id: string) {
    const t = TEMPLATE_REGISTRY.find(x => x.id === id);
    if (!t) {
        throw new Error(
            `Pinned sticker "${id}" missing from registry. Update DISTANCE/WORKOUT ids in this spec if the catalog changed.`
        );
    }
    return t;
}

test.describe('Scora App UI: Data Fallback Intelligence @regression', () => {

    test.beforeEach(async ({ page }) => {
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);
        const api = new MockStravaClient(page);
        await feedPage.injectMockAuth();
        await editorPage.injectCanvasInterceptor();
        await api.mockSuccessfulActivities();
        await feedPage.goto();
        await feedPage.waitForLoaderToHide();
    });

    test('Distance sticker on workout falls back to duration (no distance text)', async ({ page }) => {
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);

        const distanceSticker = requireSticker(DISTANCE_STICKER_ID);
        const workoutActivity = TestUtils.findFirstActivityWithoutDistance()!;

        await feedPage.openActivityEditor(workoutActivity.name);
        await editorPage.selectTemplate(distanceSticker.id);
        await editorPage.waitForDrawSettled();

        const logs = await editorPage.getCanvasTextLog();
        const normalizedLogs = TestUtils.normalizeForCanvas(logs.join(' '));

        // Workout mode contract: duration present, distance numeric absent
        expect(normalizedLogs, `log=${normalizedLogs}`).toMatch(/DURATION|MIN|MINUTE|H\s*M/);
        expect(normalizedLogs, `log=${normalizedLogs}`).not.toMatch(/\d+\.\d+KM|\dKM/);
    });

    test('Workout/map sticker on run shows distance metrics (forward-fill)', async ({ page }) => {
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);

        const mapSticker = requireSticker(WORKOUT_STICKER_ID);
        const runActivity = TestUtils.findFirstActivityWithMap()
            ?? TestUtils.findFirstActivityWithDistance()!;

        await feedPage.openActivityEditor(runActivity.name);
        await editorPage.selectTemplate(mapSticker.id);
        await editorPage.waitForDrawSettled();

        const logs = await editorPage.getCanvasTextLog();
        const normalizedLogs = TestUtils.normalizeForCanvas(logs.join(' '));
        const expected = TestUtils.getExpectedStats(runActivity);
        const distNeedle = TestUtils.normalizeForCanvas(expected.distanceVal).replace(/[A-RT-Z]/g, '');

        expect(normalizedLogs, `log=${normalizedLogs} expected=${distNeedle}`).toContain(distNeedle);
    });

    test('Opening a new activity resets sticker to default adaptive choice', async ({ page }) => {
        const feedPage = new FeedPage(page);
        const editorPage = new EditorPage(page);

        const withMap = TestUtils.findFirstActivityWithMap()!;
        const withoutDistance = TestUtils.findFirstActivityWithoutDistance()!;
        const statsA = TestUtils.getExpectedStats(withMap);
        const statsB = TestUtils.getExpectedStats(withoutDistance);

        await feedPage.openActivityEditor(withMap.name, statsA.mainValue);
        await editorPage.waitForDrawSettled();

        const thumbs = page.locator('.sticker-thumb');
        const count = await thumbs.count();
        expect(count).toBeGreaterThan(1);
        const alternateId = await thumbs.nth(1).getAttribute('data-template');
        expect(alternateId).toBeTruthy();
        await editorPage.selectTemplate(alternateId!);

        // 3-hop history: editor → stickers → feed (catalog grid is in between)
        await editorPage.goBack();
        await expect(page.getByTestId('screen-stickers')).toHaveClass(/active/);
        await editorPage.goBack();
        await feedPage.verifyActivityRendered(withMap.name, statsA.mainValue);

        await feedPage.openActivityEditor(withoutDistance.name, statsB.mainValue);
        const firstThumb = page.locator('.sticker-thumb').first();
        const expectedDefaultId = await firstThumb.getAttribute('data-template');
        expect(expectedDefaultId).toBeTruthy();
        await editorPage.waitForDrawSettled();
        await editorPage.verifyTemplateIsActive(expectedDefaultId!);
    });
});
