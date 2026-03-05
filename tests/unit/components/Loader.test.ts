import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { removeLoader } from '../../../src/components/Loader';

describe('Loader Component', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="loader-overlay">
                <div class="loader-spinner"></div>
            </div>
        `;
        // Mock timers to instantly test the setTimeout logic inside the function
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should immediately add the hidden class and remove the element from the DOM after 800ms', () => {
        const loader = document.getElementById('loader-overlay');
        expect(loader).not.toBeNull();

        // Trigger function
        removeLoader();

        // 1. Assert immediate visual hiding
        expect(loader?.classList.contains('hidden')).toBe(true);

        // 2. Element should still exist in DOM to allow CSS transition
        expect(document.getElementById('loader-overlay')).not.toBeNull();

        // 3. Fast-forward the nested setTimeout
        vi.advanceTimersByTime(800);

        // 4. Element should be completely purged from DOM
        expect(document.getElementById('loader-overlay')).toBeNull();
    });

    it('should silently succeed if the loader does not exist in the DOM', () => {
        document.body.innerHTML = ''; // Empty DOM

        // Should not throw an error
        expect(() => removeLoader()).not.toThrow();
    });
});
