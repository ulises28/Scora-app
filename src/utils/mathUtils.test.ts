import { describe, it, expect } from 'vitest';
import { calculateMaxPace } from './mathUtils';

describe('calculateMaxPace', () => {

    it('returns "0:00" for zero, negative, undefined and null', () => {
        expect(calculateMaxPace(0)).toBe('0:00');
        expect(calculateMaxPace(-5)).toBe('0:00');
        expect(calculateMaxPace(undefined)).toBe('0:00');
        expect(calculateMaxPace(null)).toBe('0:00');
    });

    /**
     * User-provided reference table (m/s input, min/km expected output):
     *   m/s × 3.6 = km/h → 60 / km/h = pace
     */
    it('converts 3.33 m/s → 12 km/h → 5:00 /km', () => {
        // 3.333... m/s × 3.6 = 12 km/h → pace = 60/12 = 5:00
        expect(calculateMaxPace(3.333)).toBe('5:00');
    });

    it('converts 2.78 m/s → 10 km/h → 6:00 /km', () => {
        // 2.778 m/s × 3.6 = 10.0 km/h → pace = 6:00
        expect(calculateMaxPace(2.778)).toBe('6:00');
    });

    it('converts 2.50 m/s → 9 km/h → 6:40 /km', () => {
        // 2.5 × 3.6 = 9 km/h → 60/9 = 6.666... → 6:40
        expect(calculateMaxPace(2.5)).toBe('6:40');
    });

    it('converts 2.22 m/s → 8 km/h → 7:30 /km', () => {
        // 2.222 × 3.6 = 8.0 km/h → 60/8 = 7:30
        expect(calculateMaxPace(2.222)).toBe('7:30');
    });

    it('converts 2.08 m/s → 7.5 km/h → 8:00 /km', () => {
        // 2.0833 × 3.6 = 7.5 km/h → 60/7.5 = 8:00
        expect(calculateMaxPace(2.0833)).toBe('8:00');
    });

    it('pads single-digit seconds correctly (e.g. :05)', () => {
        // 5.0 m/s → 18 km/h → pace = 60/18 = 3.333 min/km → 3:20
        expect(calculateMaxPace(5.0)).toBe('3:20');
    });
});
