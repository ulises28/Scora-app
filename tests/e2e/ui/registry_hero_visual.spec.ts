import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { FeedPage } from '../pages/FeedPage';
import { EditorPage } from '../pages/EditorPage';
import { MockStravaClient } from '../utils/MockStravaClient';
import { TestUtils } from '../utils/TestUtils';

/**
 * Hero visual baselines -- product-critical looks only (qa-architecture.md section 5).
 *
 * Source list: tests/e2e/fixtures/heroes.json (sticker x mode).
 * Not an exhaustive catalog dump. Data correctness lives in registry_quality_scan.
 * Baselines update ONLY via `pnpm run test:e2e:visual:accept` after human review.
 */

const heroesDoc = JSON.parse(
    readFileSync(new URL('../fixtures/heroes.json', import.meta.url), 'utf-8')
);
const HEROES = heroesDoc.heroes as Array<{ id: string; mode: 'run' | 'bike' | 'workout'; family: string; why: string }>;

test.use({ trace: 'off' });

test.describe('Scora App UI: Hero visual contracts [ @visual ]', () => {

    for (const hero of HEROES) {
        test(`hero ${hero.family} · ${hero.id} · ${hero.mode}`, async ({ page }) => {
            const feedPage = new FeedPage(page);
            const editorPage = new EditorPage(page);
            const api = new MockStravaClient(page);

            await feedPage.injectMockAuth();
            await api.mockSuccessfulActivities();
            await feedPage.goto();
            await feedPage.waitForLoaderToHide();

            const activity = hero.mode === 'workout'
                ? TestUtils.findFirstActivityWithoutDistance()!
                : TestUtils.findFirstActivityWithMap() ?? TestUtils.findFirstActivityWithDistance()!;

            await feedPage.openActivityEditor(activity.name);
            await editorPage.verifyEditorScreenVisible(activity.name);
            await editorPage.selectTemplate(hero.id);
            await page.evaluate(() => document.fonts.ready);
            await editorPage.waitForDrawSettled();
            await page.waitForTimeout(400);

            await expect(editorPage.canvasWrapper).toHaveScreenshot(
                `hero-${hero.family}-${hero.id}-${hero.mode}.png`,
                {
                    threshold: 0.35,
                    maxDiffPixelRatio: 0.15,
                }
            );
        });
    }
});
