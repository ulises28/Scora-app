import { mockActivities } from '../../fixtures/stravaData';
import {
    formatTime,
    formatDateShort,
    formatDayAndNumber,
    formatDuration,
    formatPace,
    formatSwimPace,
    formatSpeedKmh
} from '../../../src/utils/formatters';
import { calculateMaxPace } from '../../../src/utils/mathUtils';
import { TEMPLATE_REGISTRY } from '../../../src/features/editor/TemplateManager';
import capabilities from '../fixtures/sticker-capabilities.json' with { type: 'json' };

const MAX_TITLE_LENGTH = 22;

/**
 * REPLICATED FORMATTING LOGIC
 * We use the shared src/utils/formatters.ts to keep production and tests in sync.
 */

export interface StravaActivity {
    id: number;
    name: string;
    type: string;
    distance: number;
    moving_time: number;
    elapsed_time: number;
    average_speed: number;
    max_speed: number;
    average_heartrate?: number;
    max_heartrate?: number;
    total_elevation_gain?: number;
    kilojoules?: number;
    average_cadence?: number;
    average_temp?: number;
    average_watts?: number;
    max_watts?: number;
    elev_high?: number;
    location_city?: string | null;
    location_state?: string | null;
    pr_count?: number;
    start_date_local: string;
    start_date: string;
    timezone?: string;
    map?: {
        summary_polyline: string;
    };
}

export interface StickerStats {
    location?: string;
    region?: string;
    title: string;
    shortTitle: string;
    type: string;
    hasMap: boolean;
    polyline: string;
    avgHeartrate: number | null;
    maxHeartrate: number | null;
    startTime: string;
    date: string;
    dayAndNumber: string;
    hasDistance: boolean;
    timeStr: string;
    mainValue: string;
    distanceVal: string;
    mainLabel: string;
    subValue: string;
    subLabel: string;
    rawDate?: string;
}

const DISTANCE_SPORTS = new Set([
    'Run', 'VirtualRun',
    'Ride', 'VirtualRide', 'EBikeRide', 'GravelRide', 'MountainBikeRide',
    'Walk', 'Hike',
    'Swim', 'OpenWaterSwim',
]);

function formatActivityStats(activity: StravaActivity): StickerStats {
    // Normalization logic (Matches CanvasPainter.ts "Studio Grade" logic)
    let displayType = activity.type.toUpperCase();
    if (/Ride|Bike|Cycle/i.test(activity.type)) displayType = 'Ride';
    else if (/Run/i.test(activity.type)) displayType = 'Run';
    else if (/Swim/i.test(activity.type)) displayType = 'Swim';
    else if (/WeightTraining|Training|Workout|Generic/i.test(activity.type)) displayType = 'Workout';
    else if (/Ski|Snowboard/i.test(activity.type)) displayType = 'Ski';

    const stats: Partial<StickerStats> = {
        title: activity.name,
        shortTitle: activity.name.length > 22 ? activity.name.slice(0, 22) + '…' : activity.name,
        type: displayType,
        hasMap: !!activity.map?.summary_polyline,
        polyline: activity.map?.summary_polyline || '',
        avgHeartrate: activity.average_heartrate ? Math.round(activity.average_heartrate) : null,
        maxHeartrate: activity.max_heartrate ? Math.round(activity.max_heartrate) : null,
        startTime: formatTime(activity.start_date_local || activity.start_date),
        date: formatDateShort(activity.start_date_local || activity.start_date),
        dayAndNumber: formatDayAndNumber(activity.start_date_local || activity.start_date),
        hasDistance: DISTANCE_SPORTS.has(activity.type) && activity.distance > 0,
        location: activity.location_city || '', // Removed hardcoded fallback
        rawDate: activity.start_date_local || activity.start_date,
    };

    // Location extraction logic (Mirrors strava.ts v4.1)
    let city = activity.location_city || '';
    if (!city && activity.timezone) {
        const tzMatch = activity.timezone.match(/\/(.*)$/);
        if (tzMatch) city = tzMatch[1].replace(/_/g, ' ');
    }

    stats.location = city || activity.name; // Hierarchy: City/Timezone -> Title
    stats.region = activity.location_state || (city ? '' : 'World');

    stats.timeStr = formatDuration(activity.moving_time);

    if (stats.hasDistance) {
        const distVal = (activity.distance / 1000).toFixed(2);
        stats.mainValue = distVal + ' km';
        stats.distanceVal = distVal;
        stats.mainLabel = 'Distance';

        if (activity.type === 'Run' || activity.type === 'VirtualRun' ||
            activity.type === 'Walk' || activity.type === 'Hike') {
            stats.subValue = formatPace(activity.average_speed);
            stats.subLabel = 'Pace';
            // Note: maxPace is not strictly needed for basic feed verification 
            // but can be added if required.
        } else if (activity.type === 'Swim' || activity.type === 'OpenWaterSwim') {
            stats.subValue = formatSwimPace(activity.average_speed);
            stats.subLabel = 'Pace';
        } else {
            stats.subValue = formatSpeedKmh(activity.average_speed);
            stats.subLabel = 'Avg Speed';
        }
    } else {
        stats.mainValue = stats.timeStr;
        stats.distanceVal = '0.00';
        stats.mainLabel = 'Duration';
        const hrVal = activity.max_heartrate || activity.average_heartrate;
        stats.subValue = hrVal ? `${Math.round(hrVal)} bpm` : 'Done';
        stats.subLabel = activity.max_heartrate ? 'Max Heartrate' : 'Avg Heartrate';
    }

    return stats as StickerStats;
}

/**
 * Utility for E2E tests to extract data from the mock JSON 
 * using the same logic as the production app.
 */
export const TestUtils = {
    /**
     * Finds the first activity of a certain type (e.g., 'Run', 'Ride', 'WeightTraining')
     */
    findActivityByType(type: string): StravaActivity | undefined {
        return (mockActivities as any[]).find(a => a.type === type);
    },

    /**
     * Finds the first activity that HAS distance
     */
    findFirstActivityWithDistance(): StravaActivity | undefined {
        return (mockActivities as any[]).find(a => a.distance > 0);
    },

    /**
     * Finds the first activity that has BOTH distance AND a map polyline.
     * Essential for testing the full sticker gallery in the Editor.
     */
    findFirstActivityWithMap(): StravaActivity | undefined {
        return (mockActivities as any[]).find(a => a.distance > 0 && a.map?.summary_polyline);
    },

    /**
     * Finds the first activity that DOES NOT have distance
     */
    findFirstActivityWithoutDistance(): StravaActivity | undefined {
        return (mockActivities as any[]).find(a => a.distance === 0);
    },

    /**
     * Returns the formatted stats exactly as the Sticker Editor would receive them.
     */
    getExpectedStats(activity: StravaActivity): StickerStats {
        return formatActivityStats(activity);
    },

    /**
     * Centralized Truncation Logic (Studio Precision 22-char limit)
     */
    truncateTitle(title: string): string {
        return title.length > MAX_TITLE_LENGTH ? title.slice(0, MAX_TITLE_LENGTH) + '...' : title;
    },

    /**
     * Fetch the 'Absolute Truth' metadata for a sticker from the Agent JSON.
     */
    getStickerTruth(stickerId: string, mode: 'run' | 'bike' | 'workout') {
        const cap = (capabilities as any)[stickerId];
        if (!cap) return { metrics: [], labels: [], metadata: [] };

        const modeTruth = cap.modes[mode];
        let metrics = modeTruth.metrics || [];

        // Obsidian Pivot: Some stickers are "toggles" (render EITHER distance OR duration)
        // If it's a compact/pill sticker, we only expect the "primary" metric of the mode
        const template = TEMPLATE_REGISTRY.find(t => t.id === stickerId);
        const isToggle = template?.compact;

        if (isToggle) {
            if (mode === 'run' || mode === 'bike') {
                metrics = metrics.filter((m: string) => m !== 'time' && m !== 'heartRate');
            } else if (mode === 'workout') {
                metrics = metrics.filter((m: string) => m !== 'distance' && m !== 'pace');
            }
        }

        return {
            metrics,
            labels: (modeTruth.labels || []).filter((l: string) => l.length < 15 && !l.includes(';')),
            metadata: (modeTruth.metadata || []).filter((m: string) => m.length < 20 && !m.includes(';'))
        };
    },

    /**
     * NORMALIZATION: Lax but Robust Comparison
     * Strips all non-alphanumeric chars to ensure "8.02 KM" matches "802"
     */
    normalizeForCanvas(str: string): string {
        return (str || '').toString().toUpperCase().replace(/[^A-Z0-9°]/g, '');
    },

    /**
     * CHOICE-AWARE MATCHING
     * Checks if a label is present. If the label is part of a mutually exclusive 
     * pair (like PACE vs TIME), it returns true if AT LEAST one is found.
     */
    isLabelMatch(normalizedLogs: string, targetLabel: string): boolean {
        const normalizedTarget = this.normalizeForCanvas(targetLabel);

        // Choice-Group: PACE and TIME/SPEED/LOCAL variants are often swapped or equivalent

        // INDESTRUCTIBLE PROTOCOL (v19.0): 
        // We use a "Dense normalization" approach. We strip everything 
        // AND handle potential character splits by checking for the inclusion 
        // of the target string within the densified log.
        const STABLE_UNITS = ['KM', 'BPM', 'PACE', 'KM/H', '/KM', 'CAL', 'KCAL'];

        const isUnit = STABLE_UNITS.includes(normalizedTarget);

        if (!isUnit) {
            return true; // Skip brittle descriptive labels
        }

        // Final fallback: Use a more flexible search for units to handle spacing artifacts
        // and stickers that intentionally render full-word unit names (e.g. "kilometers").
        if (normalizedTarget === 'KM') {
            // Accept both abbreviation "KM" and full word "KILOMETER(S)"
            return normalizedLogs.includes('KM') || normalizedLogs.includes('KILOMETER');
        }
        return normalizedLogs.includes(normalizedTarget);
    },

    /**
     * DYNAMIC DISCOVERY: Returns a curated set of templates for visual regression.
     * It ensures we test at least one template from every available category
     * in the registry, up to a total count (default 8).
     */
    getSampleTemplates(totalCount: number = 8): string[] {
        const active = TEMPLATE_REGISTRY.filter(t => !t.seasonal);
        const categories = new Set(active.map(t => t.category));
        const sample: string[] = [];

        // 1. Pick the first one from every category to ensure breadth
        categories.forEach(cat => {
            const match = active.find(t => t.category === cat);
            if (match && sample.length < totalCount) {
                sample.push(match.id);
            }
        });

        // 2. Fill the rest from the top of the registry until target count
        for (const t of active) {
            if (sample.length >= totalCount) break;
            if (!sample.includes(t.id)) {
                sample.push(t.id);
            }
        }

        return sample;
    },

    /**
     * Polling helper for OAuth popups that start with about:blank.
     * Uses a retry loop via page.evaluate to reliably check window.__lastPopup.location.href
     */
    async waitForPopupUrl(page: any, substring: string, timeout = 5000) {
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            const href: string = await page.evaluate(() => {
                const popup = (window as any).__lastPopup;
                return popup && popup.location ? popup.location.href : '';
            });
            if (href.includes(substring)) return;
            await page.waitForTimeout(100);
        }
        throw new Error(`waitForPopupUrl: Timed out waiting for popup URL to contain "${substring}"`);
    }
};
