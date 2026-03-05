import { describe, it, expect } from 'vitest';
import { formatActivityStats } from '../../../src/api/strava';

describe('formatActivityStats', () => {
    it('should format a Run activity correctly', () => {
        const mockRun = {
            name: 'Morning Run',
            type: 'Run',
            moving_time: 3660, // 1h 10m? No, 3600 is 1h, 60 is 1m. So 1h 1m
            average_speed: 3.33, // ~300.3 sec/km => 5:00 /km
            distance: 5000, // 5 km
            max_speed: 4.5,
            map: { summary_polyline: 'abc' }
        };

        const result = formatActivityStats(mockRun);

        expect(result.title).toBe('Morning Run');
        expect(result.type).toBe('Run');
        expect(result.hasMap).toBe(true);
        expect(result.polyline).toBe('abc');

        // 3660 / 3600 = 1h. 3660 % 3600 = 60. 60 / 60 = 1m. -> 1h 1m
        expect(result.timeStr).toBe('1h 1m');

        // 5000 / 1000 = 5.00
        expect(result.mainValue).toBe('5.00 km');
        expect(result.distanceVal).toBe('5.00');
        expect(result.mainLabel).toBe('DISTANCE');
        expect(result.subLabel).toBe('PACE');

        // paceSecs = Math.floor(1000 / 3.33) = 300
        // 300 / 60 = 5. 300 % 60 = 0. -> 5:00 /km
        expect(result.subValue).toBe('5:00 /km');
    });

    it('should format a non-Run activity correctly', () => {
        const mockWorkout = {
            name: 'Yoga Session',
            type: 'Yoga',
            moving_time: 1800, // 30m
            max_heartrate: 120,
            map: null
        };

        const result = formatActivityStats(mockWorkout);

        expect(result.title).toBe('Yoga Session');
        expect(result.type).toBe('Yoga');
        expect(result.hasMap).toBe(false);
        expect(result.polyline).toBe('');

        expect(result.timeStr).toBe('30m');
        expect(result.mainValue).toBe('30m');
        expect(result.mainLabel).toBe('DURATION');

        expect(result.distanceVal).toBe('0.00');
        expect(result.maxPace).toBe('0:00');

        expect(result.subValue).toBe('120 bpm');
        expect(result.subLabel).toBe('MAX HEARTRATE');
    });

    it('should format a non-Run activity correctly without heartrate', () => {
        const mockWorkout = {
            name: 'Weight Training',
            type: 'WeightTraining',
            moving_time: 3600, // 60m -> 1h 0m
            map: null
        };

        const result = formatActivityStats(mockWorkout);

        expect(result.subValue).toBe('Done');
        expect(result.timeStr).toBe('1h 0m');
    });
});
