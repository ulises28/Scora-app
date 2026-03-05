import { describe, it, expect, vi } from 'vitest';
import { createActivityCard } from '../../../src/components/ActivityCard';

// Since this test interacts with the DOM, vitest needs jsdom environment configured
// We can add a pragma comment at the top, or just rely on global vitest config if available.
// For safety, we'll explicitly declare the environment here for this file:
// @vitest-environment jsdom

describe('ActivityCard UI Component', () => {
    it('should create an HTML Div Element with the correct classes and data', () => {
        const mockStats = {
            title: 'Evening Run',
            mainValue: '7.50 km',
            type: 'Run'
        };
        const mockOnClick = vi.fn();

        const card = createActivityCard(mockStats, mockOnClick);

        // Verify HTML Structure
        expect(card).toBeInstanceOf(HTMLDivElement);
        expect(card.className).toBe('activity-card');

        // Verify content injection
        const titleSpan = card.querySelector('.card-title');
        expect(titleSpan?.textContent).toBe('Evening Run');

        const metaSpan = card.querySelector('.card-meta');
        expect(metaSpan?.textContent).toBe('7.50 km • Run');
    });

    it('should trigger the provided callback when clicked', () => {
        const mockStats = { title: 'Test', mainValue: '1', type: 'Run' };
        const mockOnClick = vi.fn();

        const card = createActivityCard(mockStats, mockOnClick);

        // Simulate User Interaction
        card.click();

        // Verify Callback Execution
        expect(mockOnClick).toHaveBeenCalledTimes(1);
    });
});
