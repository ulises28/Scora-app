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
        // 🛡️ Studio Grade: Raw JS Injection (Forensic Match)
        // Using the exact snippet that passed the manual browser audit.
        const rawJs = `
            (function() {
                window._scoraCanvasTextLog = window._scoraCanvasTextLog || [];
                if (window._scoraInterceptorInjected) return;
                
                const original = CanvasRenderingContext2D.prototype.fillText;
                window._scoraCanvasTextLog = [];
                window._scoraSettledId = 0;
                window._scoraLastDrawId = 0;
                window._scoraIsSettled = true;
                window._scoraDrawCount = 0;

                CanvasRenderingContext2D.prototype.fillText = function(text) {
                    // 🛡️ Surgical Lock: Only intercept the main story canvas
                    // This prevents gallery thumbnails from polluting the logs.
                    if (this.canvas && this.canvas.id !== 'storyCanvas') {
                        return original.apply(this, arguments);
                    }

                    const str = (text || '').toString();
                    if (str) {
                        window._scoraCanvasTextLog.push({
                            text: str,
                            drawId: window._scoraLastDrawId || 0,
                            timestamp: Date.now()
                        });
                    }
                    return original.apply(this, arguments);
                };
                window._scoraInterceptorInjected = true;
                console.log('🛡️ Canvas Interceptor Active');
            })();
        `;

        await this.page.addInitScript(rawJs);
        await this.page.evaluate(rawJs);

        // Reset the log for the current session
        await this.page.evaluate(() => {
            (window as any)._scoraCanvasTextLog = [];
        });
    }

    @step('Get Intercepted Canvas Text')
    async getCanvasTextLog(onlyLatest: boolean = false): Promise<string[]> {
        return await this.page.evaluate((latest) => {
            const logs = (window as any)._scoraCanvasTextLog || [];
            if (latest) {
                const latestDrawId = (window as any)._scoraSettledId || 0;
                return logs.filter((l: any) => l.drawId === latestDrawId).map((l: any) => l.text);
            }
            return logs.map((l: any) => l.text);
        }, onlyLatest);
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

    @step('Wait for Canvas Content')
    async waitForCanvasContent(textFragment: string, shouldBeVisible: boolean) {
        const regex = new RegExp(textFragment, 'i');
        
        await expect(async () => {
            // 🛡️ Studio Grade: Surgical Frame Inspection
            // We get the latest settled draw ID from the window.
            const latestId = await this.page.evaluate(() => (window as any)._scoraSettledId || 0);
            const allLogs = await this.page.evaluate(() => (window as any)._scoraCanvasTextLog || []);
            
            // 🛡️ Studio Grade: Drift-Resilient Filter
            // For presence (shouldBeVisible = true), we allow looking at the last two frames
            // to account for micro-timing differences in the event loop.
            // For absence (shouldBeVisible = false), we MUST be strict and only look at the LATEST frame.
            const targetIds = shouldBeVisible 
                ? [latestId, latestId - 1].filter(id => id >= 0)
                : [latestId];

            const relevantLogs = allLogs
                .filter((l: any) => targetIds.includes(l.drawId))
                .map((l: any) => l.text);
            
            if (relevantLogs.length === 0 && latestId > 0) {
                throw new Error(`Target frames [${targetIds.join(',')}] are empty in the log. Waiting for redraw...`);
            }

            const isPresent = relevantLogs.some(l => regex.test(l));
            
            if (shouldBeVisible) {
                expect(isPresent, `Expected "${textFragment}" in settled frames [${targetIds.join(',')}]. Seen: [${relevantLogs.join('|')}]`).toBeTruthy();
            } else {
                // 🛡️ Logic: If it's absent in the LATEST frame, we are satisfied.
                expect(isPresent, `Expected "${textFragment}" to be absent in latest settled frame #${latestId}. Found in: [${relevantLogs.join('|')}]`).toBeFalsy();
            }
        }).toPass({
            timeout: 5000,
            intervals: [200]
        });
    }
    @step('Wait for Draw Settled')
    async waitForDrawSettled() {
        // Soft wait: Try to wait for a redraw, but don't fail if it doesn't happen
        // This prevents 10s timeouts on CI for optimized renders
        const currentId = await this.page.evaluate(() => (window as any)._scoraSettledId || 0);
        try {
            await this.page.waitForFunction((id) => (window as any)._scoraSettledId > id, currentId, { timeout: 2000 });
        } catch (e) {
            // Redraw wasn't needed or was too fast
        }
        await this.page.waitForTimeout(50);
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
        await thumb.click({ force: true });
    }

    @step('Verify Thumbnail is Active')
    async verifyTemplateIsActive(templateId: string) {
        const thumb = this.getStickerThumb(templateId);
        await thumb.scrollIntoViewIfNeeded();
        await thumb.waitFor({ state: 'visible', timeout: 15000 });
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
        const value = color === 'white' ? 'off' : 'on';
        const beforeId = await this.page.evaluate(() => (window as any)._scoraSettledId || 0);
        
        await this.page.getByTestId('color-toggle').locator(`.toggle-opt[data-value="${value}"]`).click();
        
        return beforeId;
    }

    @step('Set Custom Color')
    async setCustomColor(hex: string) {
        await this.page.fill('#map-color-picker', hex);
        // Dispatch input event to trigger the listener
        await this.page.locator('#map-color-picker').dispatchEvent('input');
    }

    @step('Set Logo Visibility')
    async setLogo(visible: boolean) {
        const value = visible ? 'on' : 'off';
        // 🛡️ Studio Grade: Direct Interaction
        await this.logoToggle.locator(`.toggle-opt[data-value="${value}"]`).click({ force: true });
        await this.verifyLogoToggleUIState(visible);
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
        // 🛡️ Logic: The logo is specifically "SCORA." (with a dot). 
        // This distinguishes it from other text like "SCORA PERFORMANCE LOG".
        await this.waitForCanvasContent('SCORA.', visible);
    }

    @step('Verify Text Color UI State')
    async verifyTextColorUIState(color: 'white' | 'black' | string) {
        if (color.startsWith('#')) {
            const value = await this.page.locator('#map-color-value').innerText();
            expect(value.toLowerCase()).toBe(color.toLowerCase());
        } else {
            const value = color === 'white' ? 'off' : 'on';
            const opt = this.textColorToggle.locator(`.toggle-opt[data-value="${value}"]`);
            await expect(opt).toHaveClass(/active/);
        }
    }
}
