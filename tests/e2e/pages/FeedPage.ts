/**
 * [SCREEN A] Feed Page
 * Lists Strava activities as cards. Entry point for the sticker creation flow.
 */
import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { step } from '../utils/logger';

export class FeedPage extends BasePage {
    readonly authSection: Locator;
    readonly emptyStateMessage: Locator;
    readonly loginButton: Locator;
    readonly queueScreen: Locator;
    readonly queuePositionText: Locator;
    readonly emergencyButton: Locator;

    constructor(page: Page) {
        super(page);
        this.authSection = page.getByTestId('auth-section');
        this.loginButton = page.getByTestId('strava-login-btn').or(page.getByRole('button', { name: /Conectar con Strava/i }));
        this.emptyStateMessage = page.getByTestId('activity-list');
        this.queueScreen = page.getByTestId('screen-queue');
        this.queuePositionText = page.getByTestId('queue-position-text');
        this.emergencyButton = page.getByTestId('btn-admin-reset');
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

    getActivityCard(activityName: string, stats?: string): Locator {
        let card = this.page.locator('.activity-card').filter({
            has: this.page.getByText(activityName, { exact: true })
        });

        if (stats) {
            card = card.filter({
                hasText: stats
            });
        }

        return card;
    }

    @step('Verify Activity Card is Visible')
    async verifyActivityRendered(activityName: string, expectedStatsText: string) {
        const card = this.getActivityCard(activityName, expectedStatsText);
        await expect(card.first()).toBeVisible();
    }

    @step('Click Activity Card to open Editor')
    async openActivityEditor(activityName: string, stats?: string) {
        const card = this.getActivityCard(activityName, stats);
        await card.first().click();
    }

    @step('Execute Full Admin Reset Flow')
    async executeAdminResetFlow(adminUser: string, adminPass: string) {
        // 1. Setup the PERSISTENT listener BEFORE clicking
        // This stays active for the entire "Chain" of dialogs
        this.page.on('dialog', async dialog => {
            const message = dialog.message();
            console.log(`Dialog Intercepted: ${message}`);

            if (message.includes('¿Continuar?') || message.includes('Esto eliminará')) {
                // Handles both the initial check and the final hard reset confirmation
                await dialog.accept();
            }
            else if (message.includes('Usuario Maestro')) {
                // Types the admin username into the prompt
                await dialog.accept(adminUser);
            }
            else if (message.includes('Contraseña Maestra') || message.includes('password')) {
                // Types the admin password into the second prompt
                await dialog.accept(adminPass);
            }
            else if (message.includes('SISTEMA REINICIADO')) {
                // Acknowledges the final success message
                await dialog.accept();
            }
            else {
                // Safety: Dismiss anything unexpected so the test doesn't hang
                console.warn(`Unexpected Dialog: ${message}`);
                await dialog.dismiss();
            }
        });

        // 2. TRIGGER the flow (Outside the listener)
        await this.emergencyButton.waitFor({ state: 'visible' });
        await this.emergencyButton.click();
    }
}
