/**
 * Calculates Max Pace from Strava's max_speed field.
 *
 * Strava sends max_speed in meters per second (m/s).
 * Correct conversion chain: m/s → km/h → min/km (pace)
 *
 *   km/h  = m/s × 3.6
 *   pace  = 60 / km/h
 *
 * Examples (matches user table):
 *   3.33 m/s → 12.0 km/h → 5:00 /km
 *   2.78 m/s → 10.0 km/h → 6:00 /km
 *   2.50 m/s →  9.0 km/h → 6:40 /km
 *   2.22 m/s →  8.0 km/h → 7:30 /km
 *   2.08 m/s →  7.5 km/h → 8:00 /km
 */
export function calculateMaxPace(maxSpeedMs: number | undefined | null): string {
    if (!maxSpeedMs || maxSpeedMs <= 0) return '0:00';

    const speedKmh = maxSpeedMs * 3.6;          // m/s → km/h
    const paceDecimal = 60 / speedKmh;              // km/h → min/km
    const mins = Math.floor(paceDecimal);
    const secs = Math.round((paceDecimal - mins) * 60);

    return `${mins}:${secs.toString().padStart(2, '0')}`;
}
