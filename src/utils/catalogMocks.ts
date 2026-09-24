/**
 * Fixed catalog mini stats — same design sample every workout (392caf6).
 * Must match `formatActivityStats` shape: dataPoints / mainValue / HR fields.
 * Incomplete mocks make stickers early-return and ship empty grid boxes.
 */

type Slot = { label: string; value: string; unit: string };

const padSlots = (points: Slot[]): Slot[] => {
    const out = [...points];
    while (out.length < 10) out.push({ label: '', value: '-', unit: '' });
    return out;
};

/** Distance/map activity sample — run mock with map + full metric pool. */
export const MOCK_STATS_RUN = {
    title: 'Morning Run',
    shortTitle: 'Morning Run',
    type: 'Run',
    activityType: 'Run',
    hasMap: true,
    // Tiny valid-looking polyline so map stickers draw a path (not empty).
    polyline: 'yhpuBrtl|QZWr@[NKRIP]@MEEg@Ko@Ck@GkAIkJ{@a@BmGg@OCKEKU?_@F]TeDj@wFPeCP{Al@aHvAwQNkAViEz@yIb@aGRmBLkBR{Dd@qFBmAG}@Kq@eByEs@eBWaA[w@Qk@{@oBOs@MeAEOa@g@m@eAmDuJUc@[u@c@yAMMC@?FF\\v@dB~CvId@hALd@VfBJP\\`@T`@jAdDdAfCRr@dAnCt@fBHZFd@J|@?`@q@pHIh@KnAQrAIbAEjAKj@Y`DKTMFWB}CWe@?i@DsARuBp@wAp@_Az@g@j@u@jAYt@Qx@ObB@pBD|@Ht@f@lDP~@`@pAdBfFvAnI`@lBh@bBN`@^n@NPPLL@DAHKDKZqEBMBADF?L]fFo@hGAZi@pGE|@S`BYdES~ACp@[bDYjE_@rDG`AQ`BEbASbBKbAIRKF_@@u@NiAf@UR}@pASl@Gj@AjBSxB@JDHpAL`@PBA?WPqAR_AN]bA_BZo@Jo@TyBLIzAAp@MNOh@qALQb@_@HSB_@ES]iAKQKK_@UiA_@GOAe@Bg@ZgDDw@J_Af@kHLcADu@XyC^eFFWLKNG^@rCXrARxBTvAHz@@p@CdBLtCHJL?HCFCDo@X_@^',
    avgHeartrate: 142,
    maxHeartrate: 168,
    hr: 142,
    startTime: '10:00 AM',
    date: 'March 22, 2026',
    dayName: 'Sunday',
    dayAndNumber: 'Sun 22',
    dayNumber: 1,
    avgTemp: '17',
    hasDistance: true,
    timeStr: '41m',
    movingTime: '41m',
    mainValue: '10.05 km',
    distanceVal: '10.05',
    distanceUnit: 'km',
    mainLabel: 'Distance',
    subValue: '4:09',
    subLabel: '/km',
    maxPace: '3:45',
    maxPaceLabel: 'Max Pace',
    maxPaceUnit: 'min/km',
    rawDate: '2026-03-22T10:00:00Z',
    location: 'Madrid',
    region: 'Spain',
    calories: '720',
    deviceName: 'Garmin Forerunner 970',
    dataPoints: padSlots([
        { label: 'Distance', value: '10.05', unit: 'km' },
        { label: 'Pace', value: '4:09', unit: '/km' },
        { label: 'Duration', value: '41m', unit: '' },
        { label: 'Time', value: '10:00 AM', unit: '' },
        { label: 'Max Pace', value: '3:45', unit: '/km' },
        { label: 'Elevation', value: '36', unit: 'm' },
        { label: 'Cadence', value: '83', unit: 'spm' },
        { label: 'Max HR', value: '168', unit: 'bpm' },
        { label: 'Location', value: 'Madrid', unit: '' },
        { label: 'Date', value: 'Sun 22', unit: '' },
    ]),
};

/** Workout sample — no distance/map (accurate for gym/HIIT minis). */
export const MOCK_STATS_WORKOUT = {
    title: 'HIIT matutino',
    shortTitle: 'HIIT matutino',
    type: 'Workout',
    activityType: 'Workout',
    hasMap: false,
    polyline: '',
    avgHeartrate: 176,
    maxHeartrate: 185,
    hr: 176,
    startTime: '8:00 AM',
    date: 'March 21, 2026',
    dayName: 'Saturday',
    dayAndNumber: 'Sat 21',
    dayNumber: 1,
    avgTemp: null,
    hasDistance: false,
    timeStr: '52m',
    movingTime: '52m',
    mainValue: '52m',
    distanceVal: '0.00',
    distanceUnit: 'km',
    mainLabel: 'Duration',
    subValue: '176 bpm',
    subLabel: 'Avg Heartrate',
    maxPace: '0:00',
    maxPaceLabel: 'Max Pace',
    maxPaceUnit: 'min/km',
    rawDate: '2026-03-21T08:00:00Z',
    location: 'Madrid',
    region: 'Spain',
    calories: '480',
    deviceName: 'Garmin Forerunner 970',
    dataPoints: padSlots([
        { label: 'Duration', value: '52m', unit: '' },
        { label: 'Avg HR', value: '176', unit: 'bpm' },
        { label: 'Max HR', value: '185', unit: 'bpm' },
        { label: 'Type', value: 'Workout', unit: '' },
        { label: 'Name', value: 'HIIT matutino', unit: '' },
        { label: 'Location', value: 'Madrid', unit: '' },
        { label: 'Date', value: 'Sat 21', unit: '' },
        { label: 'Energy', value: '480', unit: 'kcal' },
    ]),
};

export type CatalogMockStats = typeof MOCK_STATS_RUN;

/** Location label from dataPoints first, then top-level stats.location. */
export function resolveLocation(stats: any): string {
    const fromPoints = stats?.dataPoints?.find((p: any) => p.label === 'Location')?.value;
    const loc = (fromPoints && fromPoints !== '-') ? fromPoints : (stats?.location || '');
    return (loc && loc !== 'Unknown' && loc !== '-') ? loc : '';
}

/** HR from max/avg camelCase, snake_case, or shorthand `hr`. */
export function resolveHeartRate(stats: any): number | string | null {
    return stats?.maxHeartrate
        || stats?.avgHeartrate
        || stats?.hr
        || (stats?.max_heartrate ? Math.round(stats.max_heartrate) : null)
        || (stats?.average_heartrate ? Math.round(stats.average_heartrate) : null)
        || null;
}

/** mainValue with distance/time fallbacks so metric pills never render empty. */
export function resolveMainValue(stats: any): string {
    if (stats?.mainValue) return String(stats.mainValue);
    if (stats?.distanceVal && stats.distanceVal !== '0.00') {
        return `${stats.distanceVal}${stats.distanceUnit ? ' ' + stats.distanceUnit : ' km'}`;
    }
    return String(stats?.timeStr || '');
}
