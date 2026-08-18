// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TEMPLATES, initTemplateManager } from '../../../src/features/editor/TemplateManager';
import { STICKER_REGISTRY } from '../../../src/features/editor/StickerRegistry';

/**
 * TemplateManager unit tests — fully data-driven.
 *
 * ✅ No specific template name (like 'route', '8m') is ever hardcoded here.
 * ✅ All assertions derive from the live TEMPLATES array.
 * ✅ Adding, removing, or toggling templates in TemplateManager.ts requires
 *    zero changes to this file — the tests automatically cover whatever is active.
 */
describe('TemplateManager', () => {

    // Minimal DOM: empty containers — initTemplateManager generates everything.
    beforeEach(() => {
        // Mock scrollIntoView (not supported in JSDOM)
        Element.prototype.scrollIntoView = vi.fn();

        document.body.innerHTML = `
            <div id="canvas-wrapper"></div>
            <div id="sticker-gallery"></div>
            <div id="template-dots" class="hidden"></div>
            <button id="btn-template-prev"></button>
            <button id="btn-template-next"></button>
            <div id="color-toggle">
                <span class="toggle-opt active" data-value="white">White</span>
                <span class="toggle-opt" data-value="black">Black</span>
                <span class="toggle-thumb"></span>
            </div>
            <div id="logo-toggle">
                <span class="toggle-opt active" data-value="on">On</span>
                <span class="toggle-opt" data-value="off">Off</span>
                <span class="toggle-thumb"></span>
            </div>
        `;
    });

    // ── Dynamic dot generation ──────────────────────────────────────────────────
    // These tests verify the contract: the DOM reflects TEMPLATES exactly.
    // They do not care how many templates there are or what they are named.

    it('should generate exactly TEMPLATES.length thumbs', () => {
        initTemplateManager(vi.fn());
        expect(document.querySelectorAll('.sticker-thumb').length).toBe(TEMPLATES.length);
    });

    it('should generate one thumb per active template with the correct data-template attribute', () => {
        initTemplateManager(vi.fn());
        TEMPLATES.forEach(t => {
            expect(document.querySelector(`.sticker-thumb[data-template="${t}"]`)).not.toBeNull();
        });
    });

    it('should mark only the first template thumb as active on init', () => {
        initTemplateManager(vi.fn());
        document.querySelectorAll('.sticker-thumb').forEach((thumb, i) => {
            expect(thumb.classList.contains('active')).toBe(i === 0);
        });
    });

    // ── Default state ───────────────────────────────────────────────────────────

    it('should initialize with the first template active and exactly one onChange call', () => {
        const mockOnChange = vi.fn();
        const manager = initTemplateManager(mockOnChange);

        expect(manager.template).toBe(TEMPLATES[0]);
        
        const config = STICKER_REGISTRY[TEMPLATES[0]];
        const expectedColor = config?.supportsCustomColor ? '#ffffff' : 'white';
        
        expect(manager.color).toBe(expectedColor);
        expect(manager.showLogo).toBe(true);
        expect(mockOnChange).toHaveBeenCalledTimes(1); 
    });

    // ── Dot click — parameterised over all active templates ─────────────────────
    // One test case per active template. When a template is added or removed,
    // this suite grows or shrinks automatically.

    TEMPLATES.forEach((template, idx) => {
        it(`clicking the "${template}" dot (index ${idx}) updates template and fires onChange`, () => {
            const mockOnChange = vi.fn();
            const manager = initTemplateManager(mockOnChange);

            const dot = document.querySelector(`.template-dot[data-template="${template}"]`) as HTMLElement;
            dot.click();

            expect(manager.template).toBe(template);
            // 1 on init + 1 on click = 2
            const config = STICKER_REGISTRY[template];
            const expectedColor = template.startsWith('chrome') 
                ? 'rosegold' 
                : (config?.supportsCustomColor ? '#ffffff' : 'white');
            expect(mockOnChange).toHaveBeenLastCalledWith(template, expectedColor, true);

            // Exactly this dot should be active; all others must not be
            document.querySelectorAll('.template-dot').forEach(d => {
                const isTarget = (d as HTMLElement).dataset.template === template;
                expect(d.classList.contains('active')).toBe(isTarget);
            });
        });
    });

    // ── setTemplate (programmatic navigation) ──────────────────────────────────
    // Uses the last active template as a non-trivial target (works even if
    // TEMPLATES shrinks to a single entry).

    it('setTemplate should activate the correct thumb and call onChange', () => {
        const mockOnChange = vi.fn();
        const manager = initTemplateManager(mockOnChange);

        const target = TEMPLATES.at(-1)!; 
        manager.setTemplate(target);

        expect(manager.template).toBe(target);
        expect(mockOnChange).toHaveBeenCalledTimes(2); // 1 init + 1 set

        document.querySelectorAll('.sticker-thumb').forEach(d => {
            const isTarget = (d as HTMLElement).dataset.template === target;
            expect(d.classList.contains('active')).toBe(isTarget);
        });
    });

    // ── Arrow button state ──────────────────────────────────────────────────────

    it('prev button should be disabled at first template, next at last', () => {
        initTemplateManager(vi.fn());
        const prev = document.getElementById('btn-template-prev') as HTMLButtonElement;
        const next = document.getElementById('btn-template-next') as HTMLButtonElement;

        // At start: first template active
        expect(prev.disabled).toBe(true);
        expect(next.disabled).toBe(false);

        // Jump to last template
        const lastDot = document.querySelector(
            `.template-dot[data-template="${TEMPLATES.at(-1)}"]`
        ) as HTMLElement;
        lastDot.click();

        expect(next.disabled).toBe(true);
        expect(prev.disabled).toBe(false);
    });

    it('next arrow navigates forward through every active template in order', () => {
        const manager = initTemplateManager(vi.fn());
        const next = document.getElementById('btn-template-next') as HTMLButtonElement;

        for (let i = 1; i < TEMPLATES.length; i++) {
            expect(next.disabled).toBe(false);
            next.click();
            expect(manager.template).toBe(TEMPLATES[i]);
        }

        // Reached the last template — next must be disabled
        expect(next.disabled).toBe(true);
    });

    // ── Toggle controls ─────────────────────────────────────────────────────────

    it('should toggle text color to black and fire onChange', () => {
        const mockOnChange = vi.fn();
        const manager = initTemplateManager(mockOnChange);

        // Find the first sticker that supports Black/White toggle but NOT custom colors
        const bwTemplate = TEMPLATES.find(id => {
            const config = STICKER_REGISTRY[id];
            return config.supportsBlackText && !config.supportsCustomColor;
        });

        if (!bwTemplate) return; // Skip if no such template exists

        manager.setTemplate(bwTemplate);
        const initCalls = mockOnChange.mock.calls.length;

        (document.getElementById('color-toggle') as HTMLElement).click();

        expect(manager.color).toBe('black');
        expect(mockOnChange).toHaveBeenCalledTimes(initCalls + 1); 
        expect(mockOnChange).toHaveBeenLastCalledWith(bwTemplate, 'black', true);
    });

    it('should toggle logo off and fire onChange', () => {
        const mockOnChange = vi.fn();
        const manager = initTemplateManager(mockOnChange);

        (document.getElementById('logo-toggle') as HTMLElement).click();

        expect(manager.showLogo).toBe(false);
        expect(mockOnChange).toHaveBeenCalledTimes(2); // 1 init + 1 toggle
        
        const config = STICKER_REGISTRY[TEMPLATES[0]];
        const expectedColor = config?.supportsCustomColor ? '#ffffff' : 'white';
        expect(mockOnChange).toHaveBeenLastCalledWith(TEMPLATES[0], expectedColor, false);
    });
});
