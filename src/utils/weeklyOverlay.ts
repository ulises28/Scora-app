import { months } from './formatters';

/**
 * WEEKLY OVERLAYS — multi-activity aggregation for the home "Weekly Overlays" section.
 * Calories policy (user 2026-11-17): Strava's activity LIST has no `calories` field
 * (detail-only). NEVER estimate — overlays show KM / MIN and only show CAL when a
 * real value exists.
 *
 * Selection model (user 2026-11-17): days and sports are CHECKBOX sets — the user
 * ticks exactly the days (e.g. Mon + Wed + Fri) and sports (run / ride / swim /
 * workout) that must count. Never a start→end range.
 *
 * Hero rules (user 2026-11-17):
 * - Any selected session with distance → hero = total distance ("30km" = Mon 9 + Wed 7
 *   + Sat 13). Day rows: km on days with distance, min on time-only days
 *   ("monday km, tuesday min, wednesday km").
 * - No distance sessions at all → hero = total time of ALL sessions ("Weekly Time"),
 *   every day row in min.
 */

export type Weekday = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
export const WEEKDAYS: Weekday[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export type SportClass = 'run' | 'ride' | 'swim' | 'workout';
export const SPORTS: SportClass[] = ['run', 'ride', 'swim', 'workout'];

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

export interface WeeklySelection {
    /** Checked days — any subset of Mon..Sun (checkboxes, not a range). */
    days: Weekday[];
    /** Checked sports — any subset (checkboxes). */
    sports: SportClass[];
}

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
    if (t.includes('ride') || t.includes('bike') || t.includes('gravel') || t.includes('cycle')) return 'ride';
    if (t.includes('swim')) return 'swim';
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

function fmtKm(m: number, dp = 1): string {
    const km = m / 1000;
    return (km % 1 === 0 ? km.toFixed(0) : km.toFixed(dp));
}
/** Whole minutes, e.g. 48min / 150min. */
function fmtMin(sec: number): string {
    return `${Math.round(sec / 60)}min`;
}

/**
 * Buckets the selected week days × selected sports. Only days that actually have a
 * matching activity produce a bucket (rows show Mon 9km / Wed 7km / Sat 13km — not
 * empty days). Order follows the week, Mon→Sun.
 */
export function aggregateWeek(
    activities: WeeklyActivity[],
    sel: WeeklySelection,
    anchor?: Date
): DayBucket[] {
    const days = sel.days.filter(d => (WEEKDAYS as string[]).includes(d));
    const sports = new Set(sel.sports);
    if (!days.length || !sports.size) return [];

    const weekStart = startOfWeek(anchor ?? new Date());
    const wanted = new Set(days.map(d => ymd(addDays(weekStart, WEEKDAYS.indexOf(d)))));

    const buckets = new Map<number, DayBucket>();
    for (const a of activities) {
        if (!sports.has(a.sport)) continue;
        const d = new Date(a.date);
        if (isNaN(+d)) continue;
        const key = ymd(d);
        if (!wanted.has(key)) continue;
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

/**
 * Stats payload for `drawWeeklySummary`. Hero switches on the data:
 * distance total when the selection contains any distance, else total time.
 * Day rows are mixed-unit: km on distance days, min on time-only days.
 */
export function buildWeekSummaryStats(buckets: DayBucket[]) {
    const active = buckets.filter(b => b.activities.length > 0);
    const totalM = active.reduce((s, b) => s + b.distanceM, 0);
    const totalSec = active.reduce((s, b) => s + b.movingSec, 0);
    const useDistance = totalM > 0;
    return {
        weekly: active.map(b => ({
            day: b.weekday,
            value: b.distanceM > 0 ? `${fmtKm(b.distanceM)}km` : fmtMin(b.movingSec),
        })),
        weeklyTotal: useDistance ? fmtKm(totalM, 1) : String(Math.round(totalSec / 60)),
        weeklyUnit: useDistance ? 'km' : 'min',
        weeklyLabel: useDistance ? 'Weekly Distance' : 'Weekly Time',
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
