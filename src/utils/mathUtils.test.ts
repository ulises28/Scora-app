import { describe, it, expect } from 'vitest';
import { calculateMaxPace } from './mathUtils';

describe('mathUtils', () => {
    describe('calculateMaxPace', () => {
        it('returns "0:00" when maxSpeedMph is 0, undefined, or null', () => {
            expect(calculateMaxPace(0)).toBe("0:00");
            expect(calculateMaxPace(undefined)).toBe("0:00");
            expect(calculateMaxPace(null)).toBe("0:00");
            expect(calculateMaxPace(-5)).toBe("0:00"); // Negative speed boundary
        });

        it('calculates the correct pace for typical speeds', () => {
            // maxSpeedMph = 10 -> speedKmH = 16.0934 -> paceDecimal = 3.7282.. -> 3:44 /km
            expect(calculateMaxPace(10)).toBe("3:44");
        });

        it('correctly pads seconds to two digits', () => {
            // Let's ensure seconds like :05 or :06 show correctly.
            // maxSpeedMph = 12 -> speedKmH = 19.31208 -> paceDecimal = 3.10686.. -> 3:06 /km
            expect(calculateMaxPace(12)).toBe("3:06");
        });
    });
});
