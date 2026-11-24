import { describe, it, expect } from 'vitest';
import { parseDurationParts, deriveContrastInk, splitValueUnit, joinValueUnit } from '../../src/features/editor/CanvasUtils';

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

describe('CanvasUtils -> splitValueUnit / joinValueUnit (no doubled units)', () => {
    it('keeps clean value + unit pairs untouched', () => {
        expect(splitValueUnit('10.05', 'km')).toEqual({ value: '10.05', unit: 'km' });
        expect(splitValueUnit('45', 'min')).toEqual({ value: '45', unit: 'min' });
        expect(splitValueUnit('167', 'bpm')).toEqual({ value: '167', unit: 'bpm' });
    });

    it('strips the unit when the value already ends with it ("4:09 /km" + "/km")', () => {
        expect(splitValueUnit('4:09 /km', '/km')).toEqual({ value: '4:09', unit: '/km' });
        expect(splitValueUnit('4:09/km', '/km')).toEqual({ value: '4:09', unit: '/km' });
        expect(splitValueUnit('167 bpm', 'bpm')).toEqual({ value: '167', unit: 'bpm' });
        expect(splitValueUnit('10.05 KM', 'KM')).toEqual({ value: '10.05', unit: 'KM' });
    });

    it('drops time unit when value is self-describing ("1h 12m" + "min")', () => {
        expect(splitValueUnit('1h 12m', 'min')).toEqual({ value: '1h 12m', unit: '' });
        expect(splitValueUnit('1h 12min', 'min')).toEqual({ value: '1h 12min', unit: '' });
        expect(splitValueUnit('41m', 'min')).toEqual({ value: '41m', unit: '' });
        expect(splitValueUnit('1h 12m', 'm')).toEqual({ value: '1h 12m', unit: '' });
    });

    it('drops km-family unit already carried by the value', () => {
        expect(splitValueUnit('4:09 /km', 'km')).toEqual({ value: '4:09 /km', unit: '' });
        expect(splitValueUnit('25.5 km/h', 'km/h')).toEqual({ value: '25.5', unit: 'km/h' });
    });

    it('joinValueUnit never repeats the unit', () => {
        expect(joinValueUnit('4:09 /km', '/km')).toBe('4:09 /km');
        expect(joinValueUnit('1h 12m', 'min')).toBe('1h 12m');
        expect(joinValueUnit('45', 'min')).toBe('45 min');
        expect(joinValueUnit('10.05', 'km')).toBe('10.05 km');
    });
});
