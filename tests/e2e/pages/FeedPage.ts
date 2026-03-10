import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { step } from '../utils/logger';

export class FeedPage extends BasePage {
    readonly authSection: Locator;
    readonly emptyStateMessage: Locator;
    readonly loginButton: Locator;
    readonly queueScreen: Locator;
    readonly queuePositionText: Locator;

    constructor(page: Page) {
        super(page);
        this.authSection = page.locator('#auth-section');
        this.loginButton = page.locator('#btn-login');
        this.emptyStateMessage = page.locator('#activity-list');
        this.queueScreen = page.locator('#screen-queue');
        this.queuePositionText = page.locator('#queue-position-text');
    }

    @step('Verify Auth Screen is Visible')
    async verifyAuthScreenVisible() {
        await expect(this.authSection).not.toHaveClass(/hidden/, { timeout: 5000 });
    }

    @step('Verify the "Empty State" message is rendered')
    async verifyEmptyStateMessage() {
        await expect(this.emptyStateMessage).toContainText('No hay entrenamientos recientes.');
    }

    @step('Click Login Button')
    async clickLoginButton() {
        await this.loginButton.click();
    }

    @step('Verify Queue Waiting Room is Visible')
    async verifyQueueScreenVisible() {
        await expect(this.queueScreen).toHaveClass(/active/, { timeout: 5000 });
    }

    @step('Verify Queue Position Text')
    async verifyQueuePosition(expectedText: string) {
        await expect(this.queuePositionText).toHaveText(expectedText, { timeout: 5000 });
    }

    getActivityCard(activityName: string): Locator {
        return this.page.locator('.activity-card').filter({
            has: this.page.locator(`text="${activityName}"`)
        });
    }

    @step('Verify Activity Card is Visible')
    async verifyActivityRendered(activityName: string, expectedStatsText: string) {
        const card = this.getActivityCard(activityName);
        await expect(card).toBeVisible();
        await expect(card.locator('.card-meta')).toContainText(expectedStatsText);
    }

    @step('Click Activity Card to open Editor')
    async openActivityEditor(activityName: string) {
        const card = this.getActivityCard(activityName);
        await card.click();
    }
}
