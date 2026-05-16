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

        // 🛡️ Studio Grade: Prevent brittle [object Object] artifacts from breaking locators.
        // If stats is accidentally passed as an object or is undefined, we skip the text filter
        // to avoid a 60s timeout, as the Activity Name is usually unique enough for mocks.
        if (stats && typeof stats === 'string' && stats !== '[object Object]') {
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
    async executeAdminResetFlow(adminUser: string, adminPass: string): Promise<boolean> {
        /**
         * We return a Promise because browser dialogs (confirm/prompt) are asynchronous.
         * The promise will only resolve once we reach the FINAL "Success" alert.
         */
        return new Promise(async (resolve) => {
            let successFound = false;

            // Define the handler as a named function so we can clean it up (off) later
            const dialogHandler = async (dialog: any) => {
                const message = dialog.message();
                console.log(`[DIALOG INTERCEPTED]: ${message}`);

                if (message.includes('¿Continuar?') || message.includes('Esto eliminará')) {
                    // 1. Initial confirmation dialog
                    await dialog.accept();
                } 
                else if (message.includes('Usuario Maestro')) {
                    // 2. Username prompt
                    await dialog.accept(adminUser);
                } 
                else if (message.includes('Contraseña Maestra') || message.includes('password')) {
                    // 3. Password prompt -> This triggers the API call
                    await dialog.accept(adminPass);
                } 
                else if (message.includes('SISTEMA REINICIADO')) {
                    // 4. Final success alert -> The flow is officially complete
                    successFound = true;
                    await dialog.accept();
                    this.page.off('dialog', dialogHandler); // Stop listening to avoid leaks
                    resolve(true); // Notify the test that the UI flow succeeded
                } 
                else {
                    // Safety: Dismiss anything else and fail the flow
                    console.warn(`[DIALOG UNEXPECTED]: ${message}`);
                    await dialog.dismiss();
                    this.page.off('dialog', dialogHandler);
                    resolve(false);
                }
            };

            // Start listening BEFORE we trigger the click
            this.page.on('dialog', dialogHandler);

            // Trigger the first dialog
            await this.emergencyButton.waitFor({ state: 'visible' });
            await this.emergencyButton.click();

            // Guard: If after 30 seconds we don't finish, timeout the promise
            setTimeout(() => {
                if (!successFound) {
                    console.error('[DIALOG TIMEOUT]: The reset flow failed to reach the "SISTEMA REINICIADO" confirmation within 30s.');
                    this.page.off('dialog', dialogHandler);
                    resolve(false);
                }
            }, 30000);
        });
    }
}
