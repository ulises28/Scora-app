import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initTemplateManager } from '../../../src/features/editor/TemplateManager';

describe('TemplateManager', () => {

    // JSDOM mirrors the new swipe-carousel DOM structure:
    // dots under canvas-wrapper, two toggle pills
    beforeEach(() => {
        document.body.innerHTML = `
            <!-- Swipeable canvas wrapper -->
            <div id="canvas-wrapper"></div>

            <!-- Dot indicators -->
            <div id="template-dots">
                <span class="template-dot active" data-template="minimal"></span>
                <span class="template-dot" data-template="route"></span>
                <span class="template-dot" data-template="data"></span>
                <span class="template-dot" data-template="dm"></span>
                <span class="template-dot" data-template="stats"></span>
            </div>

            <!-- B/W toggle pill -->
            <div id="color-toggle">
                <span class="toggle-opt active" data-value="white">White</span>
                <span class="toggle-opt" data-value="black">Black</span>
                <span class="toggle-thumb"></span>
            </div>

            <!-- Logo toggle pill -->
            <div id="logo-toggle">
                <span class="toggle-opt active" data-value="on">On</span>
                <span class="toggle-opt" data-value="off">Off</span>
                <span class="toggle-thumb"></span>
            </div>
        `;
    });

    it('should initialize with default values', () => {
        const mockOnChange = vi.fn();
        const manager = initTemplateManager(mockOnChange);

        expect(manager.template).toBe('minimal');
        expect(manager.color).toBe('white');
        expect(manager.showLogo).toBe(true);
        expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('should update template and trigger callback when a dot is clicked', () => {
        const mockOnChange = vi.fn();
        const manager = initTemplateManager(mockOnChange);

        // Click the "route" dot (index 1)
        const routeDot = document.querySelectorAll('.template-dot')[1] as HTMLElement;
        routeDot.click();

        expect(manager.template).toBe('route');
        expect(mockOnChange).toHaveBeenCalledTimes(1);
        expect(mockOnChange).toHaveBeenCalledWith('route', 'white', true);

        // Active dot moved from minimal to route
        expect(document.querySelectorAll('.template-dot')[0].classList.contains('active')).toBe(false);
        expect(routeDot.classList.contains('active')).toBe(true);
    });

    it('should programmatically set template with setTemplate and update dots', () => {
        const mockOnChange = vi.fn();
        const manager = initTemplateManager(mockOnChange);

        manager.setTemplate('stats');

        expect(manager.template).toBe('stats');

        const statsDot = document.querySelectorAll('.template-dot')[4];
        expect(statsDot.classList.contains('active')).toBe(true);
        expect(document.querySelectorAll('.template-dot')[0].classList.contains('active')).toBe(false);
    });

    it('should toggle text color to black and trigger callback', () => {
        const mockOnChange = vi.fn();
        const manager = initTemplateManager(mockOnChange);

        const colorToggle = document.getElementById('color-toggle') as HTMLElement;
        colorToggle.click(); // White → Black

        expect(manager.color).toBe('black');
        expect(mockOnChange).toHaveBeenCalledTimes(1);
        expect(mockOnChange).toHaveBeenCalledWith('minimal', 'black', true);
    });

    it('should toggle logo off and trigger callback', () => {
        const mockOnChange = vi.fn();
        const manager = initTemplateManager(mockOnChange);

        const logoToggle = document.getElementById('logo-toggle') as HTMLElement;
        logoToggle.click(); // On → Off

        expect(manager.showLogo).toBe(false);
        expect(mockOnChange).toHaveBeenCalledTimes(1);
        expect(mockOnChange).toHaveBeenCalledWith('minimal', 'white', false);
    });
});
