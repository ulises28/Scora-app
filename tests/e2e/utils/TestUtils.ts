import { mockActivities } from '../../fixtures/stravaData';

/**
 * REPLICATED FORMATTING LOGIC
 * We copy this from src/api/strava.ts to avoid importing production config/fetch
 * which crashes in the Node/Playwright environment due to Vite's import.meta.env.
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
    const stats: Partial<StickerStats> = {
        title: activity.name,
        shortTitle: activity.name.length > 22 ? activity.name.slice(0, 22) + '…' : activity.name,
        type: activity.type,
        hasMap: !!activity.map?.summary_polyline,
        polyline: activity.map?.summary_polyline || '',
        avgHeartrate: activity.average_heartrate ? Math.round(activity.average_heartrate) : null,
        maxHeartrate: activity.max_heartrate ? Math.round(activity.max_heartrate) : null,
        startTime: (() => {
            const rawDate = activity.start_date_local || activity.start_date;
            if (!rawDate) return '';
            try {
                const timePart = rawDate.split('T')[1].replace('Z', '');
                const [hours, minutes] = timePart.split(':');
                let h = parseInt(hours, 10);
                const ampm = h >= 12 ? 'PM' : 'AM';
                h = h % 12 || 12;
                return `${h}:${minutes} ${ampm}`;
            } catch (e) { return ''; }
        })(),
        hasDistance: DISTANCE_SPORTS.has(activity.type) && activity.distance > 0,
    };

    const h_total = Math.floor(activity.moving_time / 3600);
    const m_total = Math.floor((activity.moving_time % 3600) / 60);
    stats.timeStr = h_total > 0 ? `${h_total}h ${m_total}m` : `${m_total}m`;

    if (stats.hasDistance) {
        const distVal = (activity.distance / 1000).toFixed(2);
        stats.mainValue = distVal + ' km';
        stats.distanceVal = distVal;
        stats.mainLabel = 'Distance';

        if (activity.type === 'Run' || activity.type === 'VirtualRun' ||
            activity.type === 'Walk' || activity.type === 'Hike') {
            const paceSecs = Math.floor(1000 / activity.average_speed);
            stats.subValue = `${Math.floor(paceSecs / 60)}:${(paceSecs % 60).toString().padStart(2, '0')} /km`;
            stats.subLabel = 'Pace';
        } else {
            const speedKmh = (activity.average_speed * 3.6).toFixed(1);
            stats.subValue = `${speedKmh} km/h`;
            stats.subLabel = 'Avg Speed';
        }
    } else {
        stats.mainValue = stats.timeStr;
        stats.distanceVal = '0.00';
        stats.mainLabel = 'Duration';
        stats.subValue = activity.average_heartrate ? `${Math.round(activity.average_heartrate)} bpm` : 'Done';
        stats.subLabel = 'Avg Heartrate';
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
        return mockActivities.find(a => a.type === type);
    },

    /**
     * Finds the first activity that HAS distance
     */
    findFirstActivityWithDistance(): StravaActivity | undefined {
        return mockActivities.find(a => a.distance > 0);
    },

    /**
     * Finds the first activity that DOES NOT have distance
     */
    findFirstActivityWithoutDistance(): StravaActivity | undefined {
        return mockActivities.find(a => a.distance === 0);
    },

    /**
     * Returns the formatted stats exactly as the Sticker Editor would receive them.
     */
    getExpectedStats(activity: StravaActivity): StickerStats {
        return formatActivityStats(activity);
    }
};
