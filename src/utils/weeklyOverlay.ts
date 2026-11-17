import { months } from './formatters';

/**
 * WEEKLY OVERLAYS — multi-activity aggregation for the home "Weekly Overlays" section.
 * Calories policy (user 2026-11-17): Strava's activity LIST has no `calories` field
 * (detail-only). NEVER estimate — overlays show KM / MIN and only show CAL when a
 * real value exists.
 */

export type Weekday = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
export const WEEKDAYS: Weekday[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export type SportFilter = 'all' | 'run' | 'ride' | 'workout';
export type SportClass = Exclude<SportFilter, 'all'>;

export interface WeeklyActivity {
    id: string;
    date: string;
    sport: SportClass;
    title: string;
    distanceM: number;
    movingSec: number;
    /** Real kcal only — null on list payloads. Never invented. */
    calories: number | null;
}

export interface DayRange { start: Weekday; end: Weekday }

export interface DayBucket {
    weekday: Weekday;
    date: Date;
    dateLabel: string;
    activities: WeeklyActivity[];
    distanceM: number;
    movingSec: number;
    /** null unless every activity has real calories — never a partial sum. */
    calories: number | null;
}

export function classifySport(type?: string): SportClass {
    const t = String(type || '').toLowerCase();
    if (t.includes('run') || t.includes('walk') || t.includes('hike')) return 'run';
    if (t.includes('ride') || t.includes('bike') || t.includes('gravel')) return 'ride';
    return 'workout';
}

export function toWeeklyActivity(raw: any): WeeklyActivity {
    const cal = raw?.calories;
    return {
        id: String(raw?.id ?? raw?.start_date_local ?? Math.random()),
        date: String(raw?.start_date_local || raw?.start_date || ''),
        sport: classifySport(raw?.type),
        title: String(raw?.name || raw?.type || 'Activity'),
        distanceM: Number(raw?.distance) || 0,
        movingSec: Number(raw?.moving_time) || 0,
        calories: typeof cal === 'number' && isFinite(cal) && cal > 0 ? Math.round(cal) : null,
    };
}

function ymd(d: Date): number {
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}
function addDays(d: Date, n: number): Date {
    const out = new Date(d);
    out.setDate(out.getDate() + n);
    return out;
}
/** Monday-based week start (local midnight). */
export function startOfWeek(d: Date): Date {
    const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const shift = (out.getDay() + 6) % 7; // Mon=0 … Sun=6
    return addDays(out, -shift);
}

/** Inclusive span going forward around the week: Mon→Sun = 7, Mon→Wed = 3. */
export function rangeSpanDays(range: DayRange): number {
    const s = WEEKDAYS.indexOf(range.start);
    const e = WEEKDAYS.indexOf(range.end);
    return ((e - s + 7) % 7) + 1;
}

/**
 * Rule (user 2026-11-17): max one week. Mon→Sun ok, Mon→Wed ok,
 * Mon→Mon NOT ok — same weekday means 8 days.
 */
export function validateDayRange(range: DayRange): { ok: boolean; days: number; reason?: string } {
    const s = WEEKDAYS.indexOf(range.start);
    const e = WEEKDAYS.indexOf(range.end);
    if (s < 0 || e < 0) return { ok: false, days: 0, reason: 'Unknown day' };
    if (range.start === range.end) {
        return { ok: false, days: 8, reason: `${range.start} to ${range.end} is more than a week` };
    }
    const days = rangeSpanDays(range);
    if (days > 7) return { ok: false, days, reason: 'Range must be one week or less' };
    return { ok: true, days };
}

function fmtKm(m: number, dp = 1): string {
    const km = m / 1000;
    return (km % 1 === 0 ? km.toFixed(0) : km.toFixed(dp));
}
function fmtMin(sec: number): string {
    const total = Math.round(sec / 60);
    if (total < 60) return `${total}m`;
    return `${Math.floor(total / 60)}h ${total % 60}m`;
}

export function aggregateWeek(
    activities: WeeklyActivity[],
    range: DayRange,
    filter: SportFilter,
    anchor?: Date
): DayBucket[] {
    const v = validateDayRange(range);
    if (!v.ok) return [];
    const weekStart = startOfWeek(anchor ?? new Date());
    const start = addDays(weekStart, WEEKDAYS.indexOf(range.start));
    const end = addDays(start, v.days - 1);
    const lo = ymd(start), hi = ymd(end);

    const picked = activities.filter(a => {
        const d = new Date(a.date);
        if (isNaN(+d)) return false;
        const key = ymd(d);
        return key >= lo && key <= hi && (filter === 'all' || a.sport === filter);
    });

    const buckets = new Map<number, DayBucket>();
    for (const a of picked) {
        const d = new Date(a.date);
        const key = ymd(d);
        if (!buckets.has(key)) {
            buckets.set(key, {
                weekday: WEEKDAYS[(d.getDay() + 6) % 7],
                date: d,
                dateLabel: `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`,
                activities: [],
                distanceM: 0,
                movingSec: 0,
                calories: 0,
            });
        }
        const b = buckets.get(key)!;
        b.activities.push(a);
        b.distanceM += a.distanceM;
        b.movingSec += a.movingSec;
    }
    for (const b of buckets.values()) {
        // Only a total when EVERY activity carries real calories — never a partial sum.
        b.calories = b.activities.length && b.activities.every(a => a.calories != null)
            ? b.activities.reduce((s, a) => s + (a.calories || 0), 0)
            : null;
    }
    return [...buckets.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** Stats payload for `drawWeeklySummary` (30km hero + day rows). */
export function buildWeekSummaryStats(buckets: DayBucket[], filter: SportFilter) {
    const active = buckets.filter(b => b.activities.length > 0);
    const totalM = buckets.reduce((s, b) => s + b.distanceM, 0);
    const totalSec = buckets.reduce((s, b) => s + b.movingSec, 0);
    const useDistance = totalM > 0;
    return {
        weekly: active.map(b => ({
            day: b.weekday,
            value: useDistance ? `${fmtKm(b.distanceM)}km` : fmtMin(b.movingSec),
        })),
        weeklyTotal: useDistance ? fmtKm(totalM, 1) : fmtMin(totalSec).replace('m', ''),
        weeklyUnit: useDistance ? 'km' : 'min',
        weeklyLabel: useDistance ? 'Weekly Distance' : 'Weekly Duration',
        weeklyFilter: filter,
    };
}

/** Stats payload for `drawDayRecap` (date header + icon rows). CAL only when real. */
export function buildDayRecapStats(buckets: DayBucket[]) {
    const bucket = buckets.find(b => b.activities.length > 0);
    if (!bucket) return { dayRecapDate: '', dayRecapRows: [] };
    return {
        dayRecapDate: bucket.dateLabel,
        dayRecapRows: bucket.activities.slice(0, 5).map(a => ({
            icon: a.sport,
            label: (a.title || a.sport).toUpperCase(),
            value: a.calories != null
                ? `${a.calories} CAL`
                : a.distanceM > 0
                    ? `${fmtKm(a.distanceM, 2)} KM`
                    : `${Math.round(a.movingSec / 60)} MIN`,
        })),
    };
}
