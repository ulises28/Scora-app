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
    map?: {
        summary_polyline: string;
    };
}

export interface StickerStats {
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
    if (/Ride|Bike|Cycle/i.test(activity.type)) displayType = 'BIKE';
    else if (/Run/i.test(activity.type)) displayType = 'RUN';
    else if (/Swim/i.test(activity.type)) displayType = 'SWIM';
    else if (/WeightTraining|Training|Workout|Generic/i.test(activity.type)) displayType = 'TRAIN';

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
    };

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
        
        // Final cleaning of any residual agent noise
        return {
            metrics: modeTruth.metrics || [],
            labels: (modeTruth.labels || []).filter((l: string) => l.length < 15 && !l.includes(';')),
            metadata: (modeTruth.metadata || []).filter((m: string) => m.length < 20 && !m.includes(';'))
        };
    },

    /**
     * NORMALIZATION: Lax but Robust Comparison
     * Strips all non-alphanumeric chars to ensure "8.02 KM" matches "802"
     */
    normalizeForCanvas(str: string): string {
        return (str || '').toString().toUpperCase().replace(/[^A-Z0-9]/g, '');
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
    }
};
