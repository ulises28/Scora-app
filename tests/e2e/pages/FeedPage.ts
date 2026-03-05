import { expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { step } from '../utils/logger';

export class FeedPage extends BasePage {

    @step('Verify Auth Screen is Visible')
    async verifyAuthScreenVisible() {
        const authSection = this.page.locator('#auth-section');
        await expect(authSection).not.toHaveClass(/hidden/, { timeout: 5000 });
    }

    @step('Verify the "Empty State" message is rendered')
    async verifyEmptyStateMessage() {
        const activityList = this.page.locator('#activity-list');
        await expect(activityList).toContainText('No hay entrenamientos recientes.');
    }

    @step('Verify Activity Card is Visible')
    async verifyActivityRendered(activityName: string, expectedStatsText: string) {
        const card = this.page.locator('.activity-card', { hasText: activityName });
        await expect(card).toBeVisible();
        await expect(card.locator('.card-meta')).toContainText(expectedStatsText);
    }

    @step('Click Activity Card to open Editor')
    async openActivityEditor(activityName: string) {
        const card = this.page.locator('.activity-card', { hasText: activityName });
        await card.click();
    }
}
