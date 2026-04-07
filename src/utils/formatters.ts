import { calculateMaxPace } from './mathUtils';

/**
 * Pure formatting utilities for Strava activity data.
 * These functions are side-effect free and safe for use in both
 * Browser (Vite) and Node.js (Playwright) environments.
 */

export const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
export const monthsTitleCase = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const dayNamesFull = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
export const dayNamesNormal = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Formats a raw ISO date into 'Apr 06' style (Title Case)
 */
export function formatDateNarrative(rawDate: string): string {
    if (!rawDate) return '';
    try {
        const datePart = rawDate.split('T')[0];
        const [year, month, day] = datePart.split('-');
        const mIdx = parseInt(month, 10) - 1;
        return `${monthsTitleCase[mIdx]} ${day}`;
    } catch (e) {
        return '';
    }
}

/**
 * Formats a raw ISO date into 'FRIDAY' style
 */
export function formatDayName(rawDate: string): string {
    if (!rawDate) return '';
    try {
        const datePart = rawDate.split('T')[0];
        const d = new Date(datePart + 'T12:00:00');
        return dayNamesFull[d.getDay()];
    } catch (e) {
        return '';
    }
}

/**
 * Formats a raw ISO date into '12:34 PM' style
 */
export function formatTime(rawDate: string): string {
    if (!rawDate) return '';
    try {
        const timePart = rawDate.split('T')[1]?.replace('Z', '') || '';
        const [hours, minutes] = timePart.split(':');
        if (!hours || !minutes) return '';
        
        let h = parseInt(hours, 10);
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${h}:${minutes} ${ampm}`;
    } catch (e) {
        return '';
    }
}

/**
 * Formats a raw ISO date into 'MAR 06' style
 */
export function formatDateShort(rawDate: string): string {
    if (!rawDate) return '';
    try {
        const datePart = rawDate.split('T')[0];
        const [year, month, day] = datePart.split('-');
        const mIdx = parseInt(month, 10) - 1;
        return `${months[mIdx]} ${day}`;
    } catch (e) {
        return '';
    }
}

/**
 * Formats a raw ISO date into 'FRIDAY 18' style
 */
export function formatDayAndNumber(rawDate: string): string {
    if (!rawDate) return '';
    try {
        const datePart = rawDate.split('T')[0];
        const d = new Date(datePart + 'T12:00:00');
        const dayName = dayNamesFull[d.getDay()];
        const dayNum = String(d.getDate()).padStart(2, '0');
        return `${dayName} ${dayNum}`;
    } catch (e) {
        return '';
    }
}

/**
 * Formats a raw ISO date into 'Friday 18' style
 */
export function formatDayAndNumberNormal(rawDate: string): string {
    if (!rawDate) return '';
    try {
        const datePart = rawDate.split('T')[0];
        const d = new Date(datePart + 'T12:00:00');
        const dayName = dayNamesNormal[d.getDay()];
        const dayNum = String(d.getDate()).padStart(2, '0');
        return `${dayName} ${dayNum}`;
    } catch (e) {
        return '';
    }
}

/**
 * Formats seconds into '1h 11m' or '11m'
 */
export function formatDuration(seconds: number): string {
    if (!seconds || seconds <= 0) return '0m';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * Extracts numeric value from a duration string (e.g. '1h 11m' -> '1h 11')
 */
export function getDurationValueOnly(durationStr: string): string {
    return durationStr.replace(/[a-zA-Z]+$/, '').trim();
}

/**
 * Extracts unit from a duration string (e.g. '1h 11m' -> 'm')
 */
export function getDurationUnitOnly(durationStr: string): string {
    const match = durationStr.match(/[a-zA-Z]+$/);
    return match ? match[0] : '';
}

/**
 * Converts meters per second to min/km pace string (e.g. '5:00 /km')
 */
export function formatPace(metersPerSecond: number): string {
    if (!metersPerSecond || metersPerSecond <= 0) return '0:00 /km';
    const paceSecs = Math.floor(1000 / metersPerSecond);
    const mins = Math.floor(paceSecs / 60);
    const secs = (paceSecs % 60).toString().padStart(2, '0');
    return `${mins}:${secs} /km`;
}

/**
 * Converts meters per second to min/100m pace string (e.g. '1:30 /100m')
 */
export function formatSwimPace(metersPerSecond: number): string {
    if (!metersPerSecond || metersPerSecond <= 0) return '0:00 /100m';
    const paceSecs = Math.floor(100 / metersPerSecond);
    const mins = Math.floor(paceSecs / 60);
    const secs = (paceSecs % 60).toString().padStart(2, '0');
    return `${mins}:${secs} /100m`;
}

/**
 * Converts meters per second to km/h string (e.g. '25.5 km/h')
 */
export function formatSpeedKmh(metersPerSecond: number): string {
    if (!metersPerSecond || metersPerSecond <= 0) return '0.0 km/h';
    return `${(metersPerSecond * 3.6).toFixed(1)} km/h`;
}
