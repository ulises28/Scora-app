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
    readonly canvasWrapper: Locator;

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
        this.canvasWrapper = page.locator('#canvas-wrapper');
    }

    @step('Verify Editor Screen is Visible')
    async verifyEditorScreenVisible(expectedTitle: string) {
        await expect(this.editorScreen).toHaveClass(/active/);
        // The UI truncates long titles with ellipses, so we match the beginning of the string
        // extracting a safe slice
        const safeSub = expectedTitle.slice(0, 15);
        await expect(this.titleLabel).toContainText(safeSub);
    }

    @step('Inject Canvas Text Interceptor')
    async injectCanvasInterceptor() {
        await this.page.evaluate(() => {
            (window as any)._scoraCanvasTextLog = [];
            const originalFillText = CanvasRenderingContext2D.prototype.fillText;
            CanvasRenderingContext2D.prototype.fillText = function (text, x, y, maxWidth) {
                if (typeof text === 'string') {
                    (window as any)._scoraCanvasTextLog.push(text);
                }
                return originalFillText.call(this, text, x, y, maxWidth);
            };
        });
    }

    @step('Get Intercepted Canvas Text')
    async getCanvasTextLog(): Promise<string[]> {
        return await this.page.evaluate(() => (window as any)._scoraCanvasTextLog || []);
    }

    @step('Clear Canvas Text Interceptor Log')
    async clearCanvasTextLog() {
        await this.page.evaluate(() => {
            (window as any)._scoraCanvasTextLog = [];
        });
    }

    @step('Get Canvas Draw Count')
    async getDrawCount(): Promise<number> {
        return await this.page.evaluate(() => (window as any)._scoraDrawCount || 0);
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
        await dot.waitFor({ state: 'visible' });
        await dot.click({ force: true });
    }

    @step('Verify Template Dot is Active')
    async verifyTemplateIsActive(templateName: string) {
        const dot = this.getTemplateDot(templateName);
        await expect(dot).toHaveClass(/active/);
    }

    @step('Switch Template via Dot Index')
    async switchTemplateViaDot(index: number) {
        const dots = this.page.locator('.template-dot');
        await dots.nth(index).click();
    }

    @step('Verify Active Dot Index')
    async verifyActiveDotIndex(index: number) {
        const dots = this.page.locator('.template-dot');
        await expect(dots.nth(index)).toHaveClass(/active/);
    }

    @step('Navigate to Next Template via Arrow')
    async clickNextTemplate() {
        await this.nextTemplateButton.click();
    }

    @step('Navigate to Previous Template via Arrow')
    async clickPrevTemplate() {
        await this.prevTemplateButton.click();
    }

    @step('Swipe Left (Next Template)')
    async swipeLeft() {
        const wrapper = this.page.locator('#canvas-wrapper');
        await wrapper.evaluate((el: HTMLElement) => {
            const touchStart = new Event('touchstart', { bubbles: true }) as any;
            touchStart.touches = [{ clientX: 300 }];
            el.dispatchEvent(touchStart);

            const touchEnd = new Event('touchend', { bubbles: true }) as any;
            touchEnd.changedTouches = [{ clientX: 100 }];
            el.dispatchEvent(touchEnd);
        });
    }

    @step('Swipe Right (Prev Template)')
    async swipeRight() {
        const wrapper = this.page.locator('#canvas-wrapper');
        await wrapper.evaluate((el: HTMLElement) => {
            const touchStart = new Event('touchstart', { bubbles: true }) as any;
            touchStart.touches = [{ clientX: 100 }];
            el.dispatchEvent(touchStart);

            const touchEnd = new Event('touchend', { bubbles: true }) as any;
            touchEnd.changedTouches = [{ clientX: 300 }];
            el.dispatchEvent(touchEnd);
        });
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
