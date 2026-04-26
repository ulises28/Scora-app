/**
 * [SCREEN B] Editor Page
 * The "Canvas" area. Allows template selection, toggle adjustments (color/logo), 
 * and sticker download. Resets to default state whenever a new activity is opened.
 */
import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { step } from '../utils/logger';
import { TEMPLATE_REGISTRY } from '../../../src/features/editor/TemplateManager';
const TEMPLATE_ORDER = TEMPLATE_REGISTRY.map(t => t.id);

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
        this.editorScreen = page.getByTestId('screen-editor');
        this.titleLabel = page.getByTestId('activity-title-main');
        this.nextTemplateButton = page.getByRole('button', { name: /Next template/i }); 
        this.prevTemplateButton = page.getByRole('button', { name: /Previous template/i }); 
        this.textColorToggle = page.getByTestId('color-toggle');
        this.logoToggle = page.getByTestId('logo-toggle');
        this.downloadButton = page.getByRole('button', { name: /Descargar/i }).or(page.getByTestId('download-btn'));
        this.backButton = page.getByRole('button', { name: /Back|Atrás/i }).or(page.locator('#btn-back'));
        this.canvasWrapper = page.getByTestId('canvas-main-preview');
    }

    @step('Verify Editor Screen is Visible')
    async verifyEditorScreenVisible(expectedTitle: string) {
        // Wait for removal of 'hidden' first (Studio Grade Transition)
        await expect(this.editorScreen).not.toHaveClass(/hidden/, { timeout: 10000 });
        await expect(this.editorScreen).toHaveClass(/active/);
        
        const nameEl = this.page.locator('#selected-activity-name');
        
        // Studio Precision: Handle the 22-char truncation logic used in app.ts
        const truncatedExpected = expectedTitle.length > 22 
            ? expectedTitle.slice(0, 22) 
            : expectedTitle;
            
        await expect(nameEl).toContainText(truncatedExpected);
    }

    @step('Inject Canvas Text Interceptor')
    async injectCanvasInterceptor() {
        await this.page.evaluate(() => {
            if (!(window as any)._scoraCanvasTextLog) {
                (window as any)._scoraCanvasTextLog = [];
            }
            const originalFillText = CanvasRenderingContext2D.prototype.fillText;
            CanvasRenderingContext2D.prototype.fillText = function(text, x, y, maxWidth) {
                const textStr = (text || '').toString();
                if (textStr) (window as any)._scoraCanvasTextLog.push(textStr);
                return originalFillText.apply(this, [text, x, y, maxWidth]);
            };

            const originalStrokeText = CanvasRenderingContext2D.prototype.strokeText;
            CanvasRenderingContext2D.prototype.strokeText = function(text, x, y, maxWidth) {
                const textStr = (text || '').toString();
                if (textStr) (window as any)._scoraCanvasTextLog.push(textStr);
                return originalStrokeText.apply(this, [text, x, y, maxWidth]);
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

    @step('Wait for Draw Settled')
    async waitForDrawSettled() {
        await this.page.waitForFunction(() => (window as any)._scoraIsSettled === true, { timeout: 10000 });
        // Studio Precision: Allow one frame for the fillText logs to flush to the array
        await this.page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
    }

    getStickerThumb(templateId: string): Locator {
        const slug = templateId.toLowerCase();
        return this.page.locator(`.sticker-thumb[data-template="${slug}"]`);
    }

    @step('Select Template via Gallery Thumbnail')
    async selectTemplate(templateId: string) {
        const thumb = this.getStickerThumb(templateId);
        await thumb.scrollIntoViewIfNeeded();
        await thumb.waitFor({ state: 'visible' });
        await thumb.click();
    }

    @step('Verify Thumbnail is Active')
    async verifyTemplateIsActive(templateId: string) {
        const thumb = this.getStickerThumb(templateId);
        await expect(thumb).toHaveClass(/active/);
    }

    @step('Switch Template via Thumbnail Index')
    async switchTemplateViaThumb(index: number) {
        const thumbs = this.page.locator('.sticker-thumb');
        const thumb = thumbs.nth(index);
        await thumb.waitFor({ state: 'visible' });
        await thumb.click();
    }

    @step('Verify Active Thumbnail Index')
    async verifyActiveThumbIndex(index: number) {
        const thumbs = this.page.locator('.sticker-thumb');
        await expect(thumbs.nth(index)).toHaveClass(/active/);
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
        await this.canvasWrapper.evaluate((el: HTMLElement) => {
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
        await this.canvasWrapper.evaluate((el: HTMLElement) => {
            const touchStart = new Event('touchstart', { bubbles: true }) as any;
            touchStart.touches = [{ clientX: 100 }];
            el.dispatchEvent(touchStart);

            const touchEnd = new Event('touchend', { bubbles: true }) as any;
            touchEnd.changedTouches = [{ clientX: 300 }];
            el.dispatchEvent(touchEnd);
        });
    }

    @step('Click Canvas to Copy')
    async clickCanvasToCopy() {
        await this.canvasWrapper.click({ force: true });
    }

    @step('Verify One-Tap Copy Feedback')
    async verifyCopyFeedback() {
        await expect(this.canvasWrapper).toHaveClass(/copied/);
        // Should fade out eventually
        await expect(this.canvasWrapper).not.toHaveClass(/copied/, { timeout: 3000 });
    }

    @step('Verify Desktop Arrows Visibility')
    async verifyDesktopArrowsVisibility(shouldBeVisible: boolean) {
        if (shouldBeVisible) {
            await expect(this.nextTemplateButton).toBeVisible();
            await expect(this.prevTemplateButton).toBeVisible();
        } else {
            await expect(this.nextTemplateButton).not.toBeVisible();
            await expect(this.prevTemplateButton).not.toBeVisible();
        }
    }

    @step('Set Text Color')
    async setTextColor(color: 'white' | 'black') {
        const opt = this.textColorToggle.locator(`.toggle-opt[data-value="${color}"]`);
        await opt.click();
    }

    @step('Set Logo Visibility')
    async setLogo(visible: boolean) {
        const val = visible ? 'on' : 'off';
        const opt = this.logoToggle.locator(`.toggle-opt[data-value="${val}"]`);
        await opt.click();
    }

    @step('Click Download')
    async clickDownload() {
        await this.downloadButton.click();
    }

    @step('Click Go Back')
    async goBack() {
        await this.backButton.click();
    }

    @step('Verify Logo Toggle UI State')
    async verifyLogoToggleUIState(visible: boolean) {
        if (visible) {
            await expect(this.logoToggle).not.toHaveClass(/right/);
        } else {
            await expect(this.logoToggle).toHaveClass(/right/);
        }
    }

    @step('Verify Logo Visibility on Canvas')
    async verifyLogoVisibilityOnCanvas(visible: boolean) {
        // The "Continuous Observer" pattern to handle flaky rendering in Safari
        await expect(async () => {
            const logs = await this.getCanvasTextLog();
            const isLogoVisible = logs.some(l => l.includes('SCORA'));
            if (visible) {
                expect(isLogoVisible).toBeTruthy();
            } else {
                expect(isLogoVisible).toBeFalsy();
            }
        }).toPass({
            timeout: 5000,
            intervals: [500]
        });
    }

    @step('Verify Text Color UI State')
    async verifyTextColorUIState(color: 'white' | 'black') {
        const opt = this.textColorToggle.locator(`.toggle-opt[data-value="${color}"]`);
        await expect(opt).toHaveClass(/active/);
    }
}
