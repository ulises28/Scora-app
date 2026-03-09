import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TEMPLATES, initTemplateManager } from '../../../src/features/editor/TemplateManager';

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
        document.body.innerHTML = `
            <div id="canvas-wrapper"></div>
            <div id="template-dots"></div>
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

    it('should generate exactly TEMPLATES.length dots', () => {
        initTemplateManager(vi.fn());
        expect(document.querySelectorAll('.template-dot').length).toBe(TEMPLATES.length);
    });

    it('should generate one dot per active template with the correct data-template attribute', () => {
        initTemplateManager(vi.fn());
        TEMPLATES.forEach(t => {
            expect(document.querySelector(`.template-dot[data-template="${t}"]`)).not.toBeNull();
        });
    });

    it('should mark only the first template dot as active on init', () => {
        initTemplateManager(vi.fn());
        document.querySelectorAll('.template-dot').forEach((dot, i) => {
            expect(dot.classList.contains('active')).toBe(i === 0);
        });
    });

    // ── Default state ───────────────────────────────────────────────────────────

    it('should initialize with the first template active and no onChange call', () => {
        const mockOnChange = vi.fn();
        const manager = initTemplateManager(mockOnChange);

        expect(manager.template).toBe(TEMPLATES[0]);
        expect(manager.color).toBe('white');
        expect(manager.showLogo).toBe(true);
        expect(mockOnChange).not.toHaveBeenCalled();
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
            expect(mockOnChange).toHaveBeenCalledTimes(1);
            expect(mockOnChange).toHaveBeenCalledWith(template, 'white', true);

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

    it('setTemplate should activate the correct dot without calling onChange', () => {
        const mockOnChange = vi.fn();
        const manager = initTemplateManager(mockOnChange);

        const target = TEMPLATES.at(-1)!; // last active template — always valid
        manager.setTemplate(target);

        expect(manager.template).toBe(target);
        expect(mockOnChange).not.toHaveBeenCalled(); // setTemplate is silent

        document.querySelectorAll('.template-dot').forEach(d => {
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

        (document.getElementById('color-toggle') as HTMLElement).click();

        expect(manager.color).toBe('black');
        expect(mockOnChange).toHaveBeenCalledTimes(1);
        expect(mockOnChange).toHaveBeenCalledWith(TEMPLATES[0], 'black', true);
    });

    it('should toggle logo off and fire onChange', () => {
        const mockOnChange = vi.fn();
        const manager = initTemplateManager(mockOnChange);

        (document.getElementById('logo-toggle') as HTMLElement).click();

        expect(manager.showLogo).toBe(false);
        expect(mockOnChange).toHaveBeenCalledTimes(1);
        expect(mockOnChange).toHaveBeenCalledWith(TEMPLATES[0], 'white', false);
    });
});
