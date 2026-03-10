import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { step } from '../utils/logger';
import { TEMPLATES as TEMPLATE_ORDER } from '../../../src/features/editor/TemplateManager';

export class EditorPage extends BasePage {
    readonly editorScreen: Locator;
    readonly titleLabel: Locator;
    readonly nextTemplateButton: Locator;
    readonly prevTemplateButton: Locator;
    readonly textColorToggle: Locator;
    readonly logoToggle: Locator;
    readonly downloadButton: Locator;
    readonly backButton: Locator;

    constructor(page: Page) {
        super(page);
        this.editorScreen = page.locator('#screen-editor');
        this.titleLabel = page.locator('#selected-activity-name');
        this.nextTemplateButton = page.locator('#btn-template-next');
        this.prevTemplateButton = page.locator('#btn-template-prev');
        this.textColorToggle = page.locator('#color-toggle');
        this.logoToggle = page.locator('#logo-toggle');
        this.downloadButton = page.locator('#btn-download');
        this.backButton = page.locator('#btn-back');
    }

    @step('Verify Editor Screen is Visible')
    async verifyEditorScreenVisible(expectedTitle: string) {
        await expect(this.editorScreen).toHaveClass(/active/);
        await expect(this.titleLabel).toHaveText(expectedTitle);
    }

    getTemplateDot(templateName: string): Locator {
        const slug = templateName.toLowerCase();
        return this.page.locator(`.template-dot[data-template="${slug}"]`);
    }

    @step('Select Template via Arrow Navigation')
    async selectTemplate(templateName: string) {
        const targetSlug = templateName.toLowerCase();
        const targetIdx = TEMPLATE_ORDER.indexOf(targetSlug);
        if (targetIdx === -1) throw new Error(`Unknown template: "${templateName}"`);

        const dot = this.getTemplateDot(templateName);
        await dot.click();
    }

    @step('Verify Template Dot is Active')
    async verifyTemplateIsActive(templateName: string) {
        const dot = this.getTemplateDot(templateName);
        await expect(dot).toHaveClass(/active/);
    }

    @step('Navigate to Next Template via Arrow')
    async clickNextTemplate() {
        await this.nextTemplateButton.click();
    }

    @step('Navigate to Previous Template via Arrow')
    async clickPrevTemplate() {
        await this.prevTemplateButton.click();
    }

    @step('Toggle Text Color')
    async toggleTextColor() {
        await this.textColorToggle.click();
    }

    @step('Toggle Logo Visibility')
    async toggleLogo() {
        await this.logoToggle.click();
    }

    @step('Click Download')
    async clickDownload() {
        await this.downloadButton.click();
    }

    @step('Click Go Back')
    async goBack() {
        await this.backButton.click();
    }
}
