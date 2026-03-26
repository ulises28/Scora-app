import { describe, it, expect } from 'vitest';
import { parseDurationParts } from '../../src/features/editor/CanvasUtils';

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
