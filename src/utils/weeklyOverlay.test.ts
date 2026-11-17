import { describe, it, expect } from 'vitest';
import {
    validateDayRange, aggregateWeek, buildWeekSummaryStats, buildDayRecapStats,
    toWeeklyActivity, startOfWeek, rangeSpanDays, classifySport,
} from './weeklyOverlay';

const act = (id: string, date: string, over: any = {}) => ({
    id, start_date_local: date, type: 'Run', name: 'Run',
    distance: 9000, moving_time: 2700, ...over,
});

describe('validateDayRange — one week max (user rule)', () => {
    it('Mon→Sun is 7 days (ok)', () => {
        expect(validateDayRange({ start: 'Mon', end: 'Sun' })).toEqual({ ok: true, days: 7 });
    });
    it('Mon→Wed is 3 days (ok)', () => {
        expect(validateDayRange({ start: 'Mon', end: 'Wed' })).toEqual({ ok: true, days: 3 });
    });
    it('Mon→Mon is rejected — more than a week', () => {
        const r = validateDayRange({ start: 'Mon', end: 'Mon' });
        expect(r.ok).toBe(false);
        expect(r.days).toBe(8);
    });
    it('wraps forward: Fri→Mon = 4 days', () => {
        expect(rangeSpanDays({ start: 'Fri', end: 'Mon' })).toBe(4);
    });
});

describe('calorie policy — never invented', () => {
    it('list payloads (no calories) produce null bucket calories', () => {
        const buckets = aggregateWeek(
            [toWeeklyActivity(act('1', '2026-11-16T07:00:00'))],
            { start: 'Mon', end: 'Sun' }, 'all', new Date('2026-11-16T12:00:00')
        );
        expect(buckets[0].calories).toBeNull();
    });
    it('day recap shows KM/MIN when calories missing', () => {
        const buckets = aggregateWeek(
            [toWeeklyActivity(act('1', '2026-11-16T07:00:00'))],
            { start: 'Mon', end: 'Sun' }, 'all', new Date('2026-11-16T12:00:00')
        );
        const recap = buildDayRecapStats(buckets);
        expect(recap.dayRecapRows[0].value).toMatch(/KM|MIN/);
        expect(recap.dayRecapRows[0].value).not.toMatch(/CAL/);
    });
    it('real calories are shown; partial coverage yields null', () => {
        const a1 = toWeeklyActivity(act('1', '2026-11-16T07:00:00', { calories: 227, type: 'WeightTraining' }));
        const a2 = toWeeklyActivity(act('2', '2026-11-16T18:00:00', { type: 'WeightTraining' }));
        const buckets = aggregateWeek([a1, a2], { start: 'Mon', end: 'Sun' }, 'all', new Date('2026-11-16T23:00:00'));
        expect(buckets[0].calories).toBeNull(); // a2 has none → no total
        const single = aggregateWeek([a1], { start: 'Mon', end: 'Sun' }, 'all', new Date('2026-11-16T23:00:00'));
        expect(single[0].calories).toBe(227);
    });
});

describe('aggregateWeek — day range + sport grouping', () => {
    const anchor = new Date('2026-11-18T12:00:00'); // Wednesday
    const week = [
        toWeeklyActivity(act('m', '2026-11-16T07:00:00', { distance: 9000 })),                  // Mon 9km
        toWeeklyActivity(act('w', '2026-11-18T07:00:00', { distance: 7000 })),                  // Wed 7km
        toWeeklyActivity(act('s', '2026-11-21T07:00:00', { distance: 13000 })),                 // Sat 13km
        toWeeklyActivity(act('r', '2026-11-17T07:00:00', { type: 'Ride', distance: 20000 })),   // Tue ride
    ];
    it('Mon→Sun collects all run days in range', () => {
        const b = aggregateWeek(week, { start: 'Mon', end: 'Sun' }, 'run', anchor);
        expect(b.map(x => x.weekday)).toEqual(['Mon', 'Wed', 'Sat']);
    });
    it('Mon→Wed only includes Mon and Wed', () => {
        const b = aggregateWeek(week, { start: 'Mon', end: 'Wed' }, 'run', anchor);
        expect(b.map(x => x.weekday)).toEqual(['Mon', 'Wed']);
    });
    it('ride filter groups only rides', () => {
        const b = aggregateWeek(week, { start: 'Mon', end: 'Sun' }, 'ride', anchor);
        expect(b).toHaveLength(1);
        expect(b[0].weekday).toBe('Tue');
    });
    it('week summary totals and rows match the 30km reference shape', () => {
        const b = aggregateWeek(week, { start: 'Mon', end: 'Sun' }, 'run', anchor);
        const s = buildWeekSummaryStats(b, 'run');
        expect(s.weeklyTotal).toBe('29');
        expect(s.weeklyUnit).toBe('km');
        expect(s.weeklyLabel).toBe('Weekly Distance');
        expect(s.weekly).toEqual([
            { day: 'Mon', value: '9km' }, { day: 'Wed', value: '7km' }, { day: 'Sat', value: '13km' },
        ]);
    });
    it('workout totals use MIN when no distance', () => {
        const w = [toWeeklyActivity(act('w1', '2026-11-16T07:00:00', { type: 'Workout', distance: 0, moving_time: 3120 }))];
        const s = buildWeekSummaryStats(aggregateWeek(w, { start: 'Mon', end: 'Sun' }, 'workout', anchor), 'workout');
        expect(s.weeklyUnit).toBe('min');
        expect(s.weeklyLabel).toBe('Weekly Duration');
    });
    it('startOfWeek anchors on Monday', () => {
        expect(startOfWeek(new Date('2026-11-18T12:00:00')).getDay()).toBe(1);
    });
    it('classifySport buckets', () => {
        expect(classifySport('Run')).toBe('run');
        expect(classifySport('VirtualRide')).toBe('ride');
        expect(classifySport('WeightTraining')).toBe('workout');
    });
});

describe('buildDayRecapStats — Share Aura shape (multiple activities in one day)', () => {
    it('renders one row per activity with label + value', () => {
        const day = [
            toWeeklyActivity(act('1', '2026-11-16T07:00:00', { type: 'WeightTraining', name: 'Fuerza', distance: 0, moving_time: 2700 })),
            toWeeklyActivity(act('2', '2026-11-16T12:00:00', { name: 'Entreno en cinta', distance: 4620, moving_time: 1500 })),
        ];
        const recap = buildDayRecapStats(aggregateWeek(day, { start: 'Mon', end: 'Sun' }, 'all', new Date('2026-11-16T23:00:00')));
        expect(recap.dayRecapRows).toHaveLength(2);
        expect(recap.dayRecapRows[0].label).toBe('FUERZA');
        expect(recap.dayRecapRows[1].value).toBe('4.62 KM');
    });
});
