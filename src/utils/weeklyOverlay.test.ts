import { describe, it, expect } from 'vitest';
import {
    aggregateWeek, buildWeekSummaryStats, buildDayRecapStats,
    toWeeklyActivity, startOfWeek, classifySport,
} from './weeklyOverlay';

const act = (id: string, date: string, over: any = {}) => ({
    id, start_date_local: date, type: 'Run', name: 'Run',
    distance: 9000, moving_time: 2700, ...over,
});

/** Monday 2026-11-16 is the week anchor used across these cases. */
const anchor = new Date('2026-11-16T12:00:00');
const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const ALL_SPORTS = ['run', 'ride', 'swim', 'workout'] as const;

describe('hero switch + mixed rows (user spec 2026-11-17)', () => {
    it('run Mon + workout Tue + run Wed → distance hero, rows km/min/km', () => {
        const acts = [
            toWeeklyActivity(act('1', '2026-11-16T07:00:00', { distance: 9000 })),
            toWeeklyActivity(act('2', '2026-11-17T07:00:00', { type: 'WeightTraining', name: 'Gym', distance: 0, moving_time: 2880 })),
            toWeeklyActivity(act('3', '2026-11-18T07:00:00', { distance: 7000 })),
        ];
        const s = buildWeekSummaryStats(aggregateWeek(acts, { days: [...ALL_DAYS], sports: [...ALL_SPORTS] }, anchor));
        expect(s.weeklyLabel).toBe('Weekly Distance');
        expect(s.weeklyUnit).toBe('km');
        expect(s.weeklyTotal).toBe('16'); // 9 + 7 — the two running sessions
        expect(s.weekly).toEqual([
            { day: 'Mon', value: '9km' },
            { day: 'Tue', value: '48min' }, // workout day → time
            { day: 'Wed', value: '7km' },
        ]);
    });

    it('pure workouts → time hero (sum of ALL sessions), rows all min', () => {
        const acts = [
            toWeeklyActivity(act('1', '2026-11-16T07:00:00', { type: 'WeightTraining', distance: 0, moving_time: 2700 })),
            toWeeklyActivity(act('2', '2026-11-17T07:00:00', { type: 'Workout', distance: 0, moving_time: 3060 })),
        ];
        const s = buildWeekSummaryStats(aggregateWeek(acts, { days: [...ALL_DAYS], sports: [...ALL_SPORTS] }, anchor));
        expect(s.weeklyLabel).toBe('Weekly Time');
        expect(s.weeklyUnit).toBe('min');
        expect(s.weeklyTotal).toBe('96'); // (2700 + 3060) / 60
        expect(s.weekly).toEqual([
            { day: 'Mon', value: '45min' },
            { day: 'Tue', value: '51min' },
        ]);
    });

    it('30km example — rows sum to the hero', () => {
        const acts = [
            toWeeklyActivity(act('1', '2026-11-16T07:00:00', { distance: 9000 })),
            toWeeklyActivity(act('2', '2026-11-18T07:00:00', { distance: 7000 })),
            toWeeklyActivity(act('3', '2026-11-21T07:00:00', { distance: 13000 })),
        ];
        const s = buildWeekSummaryStats(aggregateWeek(acts, { days: [...ALL_DAYS], sports: [...ALL_SPORTS] }, anchor));
        expect(s.weekly.map(r => r.value)).toEqual(['9km', '7km', '13km']);
        expect(s.weeklyTotal).toBe('29');
        expect(s.weeklyUnit).toBe('km');
    });
});

describe('day checkboxes — any subset, not a range', () => {
    it('Mon+Wed+Fri selection drops other days even with data', () => {
        const acts = [
            toWeeklyActivity(act('1', '2026-11-16T07:00:00')),              // Mon
            toWeeklyActivity(act('2', '2026-11-17T07:00:00')),              // Tue — not checked
            toWeeklyActivity(act('3', '2026-11-18T07:00:00')),              // Wed
            toWeeklyActivity(act('4', '2026-11-21T07:00:00')),              // Sat — not checked
        ];
        const s = buildWeekSummaryStats(aggregateWeek(
            acts, { days: ['Mon', 'Wed', 'Fri'], sports: [...ALL_SPORTS] }, anchor
        ));
        expect(s.weekly.map(r => r.day)).toEqual(['Mon', 'Wed']);
    });
});

describe('sport checkboxes — multi-select', () => {
    it('run-only selection excludes rides and workouts', () => {
        const acts = [
            toWeeklyActivity(act('1', '2026-11-16T07:00:00', { type: 'Run', distance: 9000 })),
            toWeeklyActivity(act('2', '2026-11-17T07:00:00', { type: 'Ride', distance: 20000 })),
            toWeeklyActivity(act('3', '2026-11-18T07:00:00', { type: 'WeightTraining', distance: 0, moving_time: 2700 })),
        ];
        const s = buildWeekSummaryStats(aggregateWeek(
            acts, { days: [...ALL_DAYS], sports: ['run'] }, anchor
        ));
        expect(s.weekly).toEqual([{ day: 'Mon', value: '9km' }]);
        expect(s.weeklyTotal).toBe('9');
    });

    it('run+ride both count when both checked', () => {
        const acts = [
            toWeeklyActivity(act('1', '2026-11-16T07:00:00', { type: 'Run', distance: 9000 })),
            toWeeklyActivity(act('2', '2026-11-17T07:00:00', { type: 'Ride', distance: 20000 })),
        ];
        const s = buildWeekSummaryStats(aggregateWeek(
            acts, { days: [...ALL_DAYS], sports: ['run', 'ride'] }, anchor
        ));
        expect(s.weeklyTotal).toBe('29');
    });
});

describe('classifySport', () => {
    it('maps Strava types to the four checkbox sports', () => {
        expect(classifySport('Run')).toBe('run');
        expect(classifySport('TrailRun')).toBe('run');
        expect(classifySport('Ride')).toBe('ride');
        expect(classifySport('GravelRide')).toBe('ride');
        expect(classifySport('Swim')).toBe('swim');
        expect(classifySport('WeightTraining')).toBe('workout');
        expect(classifySport('Workout')).toBe('workout');
    });
});

describe('calorie policy — never invented', () => {
    it('list payloads (no calories) produce null bucket calories', () => {
        const buckets = aggregateWeek(
            [toWeeklyActivity(act('1', '2026-11-16T07:00:00'))],
            { days: [...ALL_DAYS], sports: [...ALL_SPORTS] }, anchor
        );
        expect(buckets[0].calories).toBeNull();
    });
    it('day recap shows KM/MIN when calories missing', () => {
        const buckets = aggregateWeek(
            [toWeeklyActivity(act('1', '2026-11-16T07:00:00'))],
            { days: [...ALL_DAYS], sports: [...ALL_SPORTS] }, anchor
        );
        const recap = buildDayRecapStats(buckets);
        expect(recap.dayRecapRows[0].value).toBe('9 KM');
    });
});

describe('week anchoring', () => {
    it('startOfWeek is Monday-based', () => {
        expect(startOfWeek(new Date('2026-11-16T12:00:00')).getDay()).toBe(1);
        expect(startOfWeek(new Date('2026-11-22T12:00:00')).getDate()).toBe(16);
    });
});
