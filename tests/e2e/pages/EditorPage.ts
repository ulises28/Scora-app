import { expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { step } from '../utils/logger';

export class EditorPage extends BasePage {

    @step('Verify Editor Screen is Visible')
    async verifyEditorScreenVisible(expectedTitle: string) {
        const editorScreen = this.page.locator('#screen-editor');
        await expect(editorScreen).toHaveClass(/active/);

        const titleLabel = this.page.locator('#selected-activity-name');
        await expect(titleLabel).toHaveText(expectedTitle);
    }

    @step('Select Timeline Template')
    async selectTemplate(templateName: string) {
        const templateBtn = this.page.locator('.template-item', { hasText: templateName });
        await templateBtn.click({ force: true });
    }

    @step('Verify Template is Active')
    async verifyTemplateIsActive(templateName: string) {
        const templateBtn = this.page.locator('.template-item', { hasText: templateName });
        await expect(templateBtn).toHaveClass(/active/);
    }

    @step('Select Text Color')
    async selectTextColor(colorValue: string) {
        const colorSelect = this.page.locator('#text-color-select');
        await colorSelect.selectOption(colorValue);
    }

    @step('Click Go Back')
    async goBack() {
        await this.page.locator('#btn-back').click();
    }
}
