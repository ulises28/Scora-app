import { describe, it, expect } from 'vitest';
import { parseDurationParts, deriveContrastInk } from '../../src/features/editor/CanvasUtils';

describe('CanvasUtils -> deriveContrastInk', () => {
    it('maps signature yellow to a deep red drop (ref pair)', () => {
        const ink = deriveContrastInk('#fbbf24');
        // Must be clearly darker and hue-pulled off yellow
        expect(ink).toMatch(/^#[0-9a-f]{6}$/i);
        expect(ink).not.toBe('#fbbf24');
    });

    it('falls back to print red for near-white', () => {
        expect(deriveContrastInk('#ffffff')).toBe('#b91c1c');
    });

    it('falls back to yellow accent for near-black', () => {
        expect(deriveContrastInk('#111111')).toBe('#fbbf24');
    });
});

describe('CanvasUtils -> parseDurationParts', () => {
    
    it('should parse standard duration with hours and minutes', () => {
        const parts = parseDurationParts('1h 30m');
        expect(parts).toEqual([
            { val: '1', unit: 'h' },
            { val: '30', unit: 'm' }
        ]);
    });

    it('should parse simple minutes', () => {
        const parts = parseDurationParts('45m');
        expect(parts).toEqual([
            { val: '45', unit: 'm' }
        ]);
    });

    it('should parse HH:MM:SS as a single unit-less block', () => {
        const parts = parseDurationParts('1:22:33');
        expect(parts).toEqual([
            { val: '1:22:33', unit: '' }
        ]);
    });

    it('should parse distances with decimal points (The Fix)', () => {
        const parts = parseDurationParts('8.02 km');
        expect(parts).toEqual([
            { val: '8.02', unit: 'km' }
        ]);
    });

    it('should parse distances without decimal points', () => {
        const parts = parseDurationParts('10 km');
        expect(parts).toEqual([
            { val: '10', unit: 'km' }
        ]);
    });

    it('should parse zero distance', () => {
        const parts = parseDurationParts('0 km');
        expect(parts).toEqual([
            { val: '0', unit: 'km' }
        ]);
    });

});
