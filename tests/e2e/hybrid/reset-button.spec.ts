import { test, expect } from '@playwright/test';
import { FeedPage } from '../pages/FeedPage';
import dotenv from 'dotenv';
dotenv.config();

test.describe('Reset Admin button for dev mode validation', () => {
    let feedPage: FeedPage;

    test.beforeEach(async ({ page }) => {
        feedPage = new FeedPage(page);
    });
    test('API - Execute the button when Everything is Clean', async ({ page, request }) => {

        await page.goto('/?admin=scora');
        await feedPage.executeAdminResetFlow(process.env.ADMIN_USER, process.env.ADMIN_PASS);

        //await expect(page.getByText('SISTEMA REINICIADO')).toBeVisible();

    });
});