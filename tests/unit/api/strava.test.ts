import { describe, it, expect } from 'vitest';
import { formatActivityStats } from '../../../src/api/strava';

describe('formatActivityStats', () => {

    // ─── Running ─────────────────────────────────────────────────────────────

    it('should format a Run activity correctly (distance + pace)', () => {
        const mockRun = {
            name: 'Morning Run',
            type: 'Run',
            moving_time: 3660,       // 1h 1m
            average_speed: 3.33,     // ~5:00 /km
            distance: 5000,          // 5 km
            max_speed: 4.5,
            map: { summary_polyline: 'abc' }
        };

        const result = formatActivityStats(mockRun);

        expect(result.title).toBe('Morning Run');
        expect(result.shortTitle).toBe('Morning Run');   // ≤15 chars — untouched
        expect(result.type).toBe('Run');
        expect(result.hasMap).toBe(true);
        expect(result.polyline).toBe('abc');
        expect(result.timeStr).toBe('1h 1m');

        expect(result.mainValue).toBe('5.00 km');
        expect(result.distanceVal).toBe('5.00');
        expect(result.mainLabel).toBe('Distance');
        expect(result.subLabel).toBe('Pace');
        expect(result.subValue).toBe('5:00 /km');
    });

    // ─── Cycling ─────────────────────────────────────────────────────────────

    it('should format a Ride activity correctly (distance + km/h speed)', () => {
        const mockRide = {
            name: 'Vuelta ciclista',
            type: 'Ride',
            moving_time: 365,        // 6m 5s
            average_speed: 4.705,   // 16.9 km/h
            max_speed: 7.683,
            distance: 1717.5,        // 1.72 km
            has_heartrate: true,
            average_heartrate: 127.7,
            max_heartrate: 145.0,
            map: { summary_polyline: '{aruBt}e|Qi@aA' }
        };

        const result = formatActivityStats(mockRide);

        expect(result.type).toBe('Ride');
        expect(result.hasMap).toBe(true);
        expect(result.mainLabel).toBe('Distance');
        expect(result.distanceVal).toBe('1.72');
        expect(result.mainValue).toBe('1.72 km');

        // Cycling: sub value is avg speed in km/h, NOT pace
        expect(result.subLabel).toBe('Avg Speed');
        expect(result.subValue).toBe('16.9 km/h');

        // Cycling: maxPace = max speed in km/h (7.683 × 3.6 = 27.7)
        expect(result.maxPace).toBe('27.7');
        expect(result.maxPaceLabel).toBe('Max Speed');
        expect(result.maxPaceUnit).toBe('km/h');
    });

    it('should NOT show 0.00 km for a Ride with valid distance', () => {
        const mockRide = {
            name: 'Short Ride',
            type: 'Ride',
            moving_time: 300,
            average_speed: 5.0,
            distance: 1500,
            max_speed: 8.0,
            map: { summary_polyline: 'abc' }
        };

        const result = formatActivityStats(mockRide);

        // This is the main regression test — was broken before
        expect(result.distanceVal).not.toBe('0.00');
        expect(result.distanceVal).toBe('1.50');
        expect(result.mainLabel).toBe('Distance');
    });

    // ─── Gym / No distance ────────────────────────────────────────────────────

    it('should format a non-distance activity correctly (Duration + heartrate)', () => {
        const mockWorkout = {
            name: 'Yoga Session',
            type: 'Yoga',
            moving_time: 1800,       // 30m
            max_heartrate: 120,
            map: null
        };

        const result = formatActivityStats(mockWorkout);

        expect(result.type).toBe('Yoga');
        expect(result.hasMap).toBe(false);
        expect(result.timeStr).toBe('30m');
        expect(result.mainValue).toBe('30m');
        expect(result.mainLabel).toBe('Duration');
        expect(result.distanceVal).toBe('0.00');
        expect(result.maxPace).toBe('0:00');
        expect(result.subValue).toBe('120 bpm');
        expect(result.subLabel).toBe('Max Heartrate');
    });

    it('should format a WeightTraining activity without heartrate', () => {
        const mockWorkout = {
            name: 'Weight Training',
            type: 'WeightTraining',
            moving_time: 3600,  // 1h 0m
            map: null
        };

        const result = formatActivityStats(mockWorkout);

        expect(result.subValue).toBe('Done');
        expect(result.timeStr).toBe('1h 0m');
    });

    // ─── Title truncation ─────────────────────────────────────────────────────

    it('should truncate shortTitle to 15 chars + ellipsis when name is long', () => {
        const mockLong = {
            name: 'Entrenamiento con pesas matutino',  // 32 chars
            type: 'WeightTraining',
            moving_time: 1800,
            map: null
        };

        const result = formatActivityStats(mockLong);

        expect(result.title).toBe('Entrenamiento con pesas matutino');  // full title preserved
        expect(result.shortTitle).toBe('Entrenamiento con pesa…'); // 22 + ellipsis
        expect(result.shortTitle.length).toBeLessThanOrEqual(23); // 22 chars + 1 ellipsis
    });

    it('should NOT truncate shortTitle when name is 15 chars or fewer', () => {
        const mockShort = {
            name: 'Morning Run',     // 11 chars
            type: 'Run',
            moving_time: 1800,
            average_speed: 3.0,
            distance: 5000,
            max_speed: 4.0,
            map: { summary_polyline: 'abc' }
        };

        const result = formatActivityStats(mockShort);

        expect(result.shortTitle).toBe('Morning Run');
        expect(result.shortTitle).toBe(result.title);
    });

});
