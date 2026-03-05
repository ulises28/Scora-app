import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initTemplateManager } from '../../../src/features/editor/TemplateManager';

describe('TemplateManager', () => {

    // Reset JSDOM before every test to ensure a clean slate
    beforeEach(() => {
        document.body.innerHTML = `
            <div class="template-item active">Minimal</div>
            <div class="template-item">Route</div>
            <div class="template-item">Stats</div>
            
            <select id="text-color-select">
                <option value="white" selected>White</option>
                <option value="black">Black</option>
                <option value="scora-orange">Orange</option>
            </select>
        `;
    });

    it('should initialize with default values', () => {
        const mockOnChange = vi.fn();
        const manager = initTemplateManager(mockOnChange);

        expect(manager.template).toBe('minimal');
        expect(manager.color).toBe('white');
        expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('should update template and trigger callback when a UI template button is clicked', () => {
        const mockOnChange = vi.fn();
        const manager = initTemplateManager(mockOnChange);

        // Simulate click on "Route" template
        const routeBtn = document.querySelectorAll('.template-item')[1] as HTMLElement;
        routeBtn.click();

        expect(manager.template).toBe('route');
        expect(mockOnChange).toHaveBeenCalledTimes(1);
        expect(mockOnChange).toHaveBeenCalledWith('route', 'white');

        // Ensure DOM classes updated
        expect(document.querySelectorAll('.template-item')[0].classList.contains('active')).toBe(false);
        expect(routeBtn.classList.contains('active')).toBe(true);
    });

    it('should programmatically update template using setTemplate and alter the DOM', () => {
        const mockOnChange = vi.fn();
        const manager = initTemplateManager(mockOnChange);

        manager.setTemplate('stats');

        expect(manager.template).toBe('stats');

        // Assert programmatic setter also fixes the DOM (from our Phase 3 bug fix!)
        const statsBtn = document.querySelectorAll('.template-item')[2];
        expect(statsBtn.classList.contains('active')).toBe(true);
    });

    it('should update color and trigger callback on UI select change', () => {
        const mockOnChange = vi.fn();
        const manager = initTemplateManager(mockOnChange);

        const colorSelect = document.getElementById('text-color-select') as HTMLSelectElement;

        // Simulate picking orange
        colorSelect.value = 'scora-orange';
        colorSelect.dispatchEvent(new Event('change'));

        expect(manager.color).toBe('scora-orange');
        expect(mockOnChange).toHaveBeenCalledTimes(1);
        expect(mockOnChange).toHaveBeenCalledWith('minimal', 'scora-orange');
    });
});
