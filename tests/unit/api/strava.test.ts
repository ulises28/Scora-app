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
            start_date_local: "2026-03-06T09:31:09Z", // 9:31 AM
            map: { summary_polyline: 'abc' }
        };

        const result = formatActivityStats(mockRun as any);

        expect(result.title).toBe('Morning Run');
        expect(result.timeStr).toBe('1h 1m');
        expect(result.mainValue).toBe('5.00 km');
        expect(result.mainLabel).toBe('Distance');
        expect(result.subLabel).toBe('Pace');
        expect(result.subValue).toBe('5:00 /km');
        expect(result.hasMap).toBe(true);
    });

    it('should format a Private Run (No Map) correctly', () => {
        const mockPrivateRun = {
            name: 'Secret Path',
            type: 'Run',
            moving_time: 3600,
            average_speed: 3.33,
            distance: 12000,
            private: true,
            map: { summary_polyline: null } // No map
        };

        const result = formatActivityStats(mockPrivateRun as any);

        expect(result.mainLabel).toBe('Distance');
        expect(result.mainValue).toBe('12.00 km');
        expect(result.hasMap).toBe(false);
        expect(result.hasDistance).toBe(true);
    });

    // ─── Cycling ─────────────────────────────────────────────────────────────

    it('should format a Ride activity correctly (distance + km/h speed)', () => {
        const mockRide = {
            name: 'Vuelta ciclista',
            type: 'Ride',
            moving_time: 365,
            average_speed: 4.705,   // ~16.9 km/h
            max_speed: 7.683,
            distance: 1717.5,
            average_heartrate: 127.7,
            start_date_local: "2026-03-06T15:05:00Z",
            map: { summary_polyline: 'abc' }
        };

        const result = formatActivityStats(mockRide as any);

        expect(result.mainLabel).toBe('Distance');
        expect(result.subLabel).toBe('Avg Speed');
        expect(result.subValue).toBe('16.9 km/h');
        expect(result.maxPace).toBe('27.7'); // 7.6 * 3.6
        expect(result.maxPaceLabel).toBe('Max Speed');
    });

    // ─── Swimming ────────────────────────────────────────────────────────────

    it('should format a Swim activity correctly (distance + pace per 100m)', () => {
        const mockSwim = {
            name: 'Pool Session',
            type: 'Swim',
            moving_time: 1200,      // 20m
            average_speed: 0.8333,  // 100m in ~120s = 2:00
            distance: 1000,         // 1 km
            map: null
        };

        const result = formatActivityStats(mockSwim as any);

        expect(result.type).toBe('Swim');
        expect(result.mainLabel).toBe('Distance');
        expect(result.mainValue).toBe('1.00 km');
        expect(result.subLabel).toBe('Pace');
        expect(result.subValue).toBe('2:00 /100m');
    });

    // ─── Gym / No distance ────────────────────────────────────────────────────

    it('should format a non-distance activity correctly (Duration + Avg HR)', () => {
        const mockWorkout = {
            name: 'Yoga Session',
            type: 'Yoga',
            moving_time: 1800,       // 30m
            average_heartrate: 120,
            map: null
        };

        const result = formatActivityStats(mockWorkout as any);

        expect(result.mainLabel).toBe('Duration');
        expect(result.mainValue).toBe('30m');
        expect(result.subLabel).toBe('Avg Heartrate');
        expect(result.subValue).toBe('120 bpm');
        expect(result.hasDistance).toBe(false);
    });

    it('should format long durations (1h+) correctly as "1h 11m"', () => {
        const mockLong = {
            name: 'Epic Hike',
            type: 'Hike',
            moving_time: 4279, // 1h 11m 19s
            distance: 5000,
            average_speed: 1.2
        };

        const result = formatActivityStats(mockLong as any);
        expect(result.timeStr).toBe('1h 11m');
    });

    it('should format exact 1h duration correctly', () => {
        const mockExactHr = {
            name: '1 Hour Workout',
            type: 'WeightTraining',
            moving_time: 3600,
            map: null
        };
        const result = formatActivityStats(mockExactHr as any);
        expect(result.timeStr).toBe('1h 0m');
    });

    it('should format 59m 59s correctly as "59m"', () => {
        const mockAlmostHr = {
            name: 'Fast Workout',
            type: 'WeightTraining',
            moving_time: 3599,
            map: null
        };
        const result = formatActivityStats(mockAlmostHr as any);
        expect(result.timeStr).toBe('59m');
    });

    it('should format a WeightTraining activity without heartrate as "Done"', () => {
        const mockWorkout = {
            name: 'Weight Training',
            type: 'WeightTraining',
            moving_time: 3600,
            map: null
        };

        const result = formatActivityStats(mockWorkout as any);
        expect(result.subValue).toBe('Done');
        expect(result.subLabel).toBe('Avg Heartrate');
    });

    // ─── Edge Cases (Safety) ───────────────────────────────────────────────────

    it('should handle zero distance and speed without crashing', () => {
        const mockZero = {
            name: 'Standing Still',
            type: 'Run',
            moving_time: 10,
            distance: 0,
            average_speed: 0
        };
        const result = formatActivityStats(mockZero as any);
        expect(result.hasDistance).toBe(false);
        expect(result.mainLabel).toBe('Duration');
        expect(result.mainValue).toBe('0m');
    });

    it('should fallback to start_date if start_date_local is missing', () => {
        const mockNoLocal = {
            name: 'No Local Date',
            type: 'Run',
            moving_time: 1800,
            average_speed: 3.0,
            distance: 5000,
            start_date_local: null,
            start_date: "2026-03-06T12:00:00Z"
        };
        const result = formatActivityStats(mockNoLocal as any);
        expect(result.startTime).toBe('12:00 PM');
    });

    // ─── Title truncation ─────────────────────────────────────────────────────

    it('should truncate shortTitle correctly for long names', () => {
        const mockLong = {
            name: 'Entrenamiento con pesas matutino de lunes', // Very long
            type: 'WeightTraining',
            moving_time: 1800
        };

        const result = formatActivityStats(mockLong as any);
        expect(result.shortTitle).toBe('Entrenamiento con pesa…'); // 22 chars + ...
    });

});
