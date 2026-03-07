import { expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { step } from '../utils/logger';

const TEMPLATE_ORDER = ['minimal', 'route', 'data', 'dm', 'stats'];

export class EditorPage extends BasePage {

    @step('Verify Editor Screen is Visible')
    async verifyEditorScreenVisible(expectedTitle: string) {
        const editorScreen = this.page.locator('#screen-editor');
        await expect(editorScreen).toHaveClass(/active/);

        const titleLabel = this.page.locator('#selected-activity-name');
        await expect(titleLabel).toHaveText(expectedTitle);
    }

    /**
     * Navigate to a template using the prev/next arrow buttons.
     * Works consistently on both desktop (arrows) and mobile (swipe not reliable in Playwright).
     */
    @step('Select Template via Arrow Navigation')
    async selectTemplate(templateName: string) {
        const targetSlug = templateName.toLowerCase();
        const targetIdx = TEMPLATE_ORDER.indexOf(targetSlug);
        if (targetIdx === -1) throw new Error(`Unknown template: "${templateName}"`);

        // Click the target dot directly — most reliable in Playwright
        const dot = this.page.locator(`.template-dot[data-template="${targetSlug}"]`);
        await dot.click();
    }

    @step('Verify Template Dot is Active')
    async verifyTemplateIsActive(templateName: string) {
        const slug = templateName.toLowerCase();
        const dot = this.page.locator(`.template-dot[data-template="${slug}"]`);
        await expect(dot).toHaveClass(/active/);
    }

    @step('Navigate to Next Template via Arrow')
    async clickNextTemplate() {
        await this.page.locator('#btn-template-next').click();
    }

    @step('Navigate to Previous Template via Arrow')
    async clickPrevTemplate() {
        await this.page.locator('#btn-template-prev').click();
    }

    @step('Toggle Text Color')
    async toggleTextColor() {
        await this.page.locator('#color-toggle').click();
    }

    @step('Toggle Logo Visibility')
    async toggleLogo() {
        await this.page.locator('#logo-toggle').click();
    }

    @step('Click Download')
    async clickDownload() {
        await this.page.locator('#btn-download').click();
    }

    @step('Click Go Back')
    async goBack() {
        await this.page.locator('#btn-back').click();
    }
}
