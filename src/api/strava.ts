// IMPORTAMOS LOS SECRETOS DEL ARCHIVO DE CONFIGURACIÓN
// (Este archivo config.js no se subirá a GitHub)
import { STRAVA_CONFIG } from '../config.js';
import { calculateMaxPace } from '../utils/mathUtils';

// Usamos las variables importadas
const CLIENT_ID = STRAVA_CONFIG.CLIENT_ID;
const CLIENT_SECRET = STRAVA_CONFIG.CLIENT_SECRET;
const REDIRECT_URI = STRAVA_CONFIG.REDIRECT_URI;

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
    timezone?: string;
    pr_count?: number;
    start_date_local: string;
    start_date: string;
    map?: {
        summary_polyline: string;
    };
}

export interface SplitMetric {
    distance: number;
    elapsed_time: number;
    elevation_difference: number;
    moving_time: number;
    split: number;
    average_speed: number;
    pace_zone: number;
}

export interface DetailedActivity extends StravaActivity {
    splits_metric?: SplitMetric[];
    laps?: any[];
    gear?: { name: string };
    device_name?: string;
}

export interface StickerStatSlot {
    label: string;
    value: string;
    unit: string;
}

export interface StickerStats {
    id: number;
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
    maxPace: string;
    maxPaceLabel: string;
    maxPaceUnit: string;
    dataPoints: StickerStatSlot[];
    splits?: { type: 'full' | 'partial', label: string, pace: string, seconds: number }[];
    fastestPaceSeconds?: number;
    deviceName?: string;
}

// 1. Construye el link al que enviaremos al usuario
export function getStravaLoginUrl() {
    // Changed approval_prompt=force to auto so it doesn't ask for permission every time
    return `https://www.strava.com/oauth/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${REDIRECT_URI}&approval_prompt=auto&scope=activity:read_all`;
}

// 2. Intercambia el "code" de la URL por el Token de acceso usando el backend de Vercel
export async function exchangeToken(code: string, sessionId: string = 'fallback') {
    const url = '/api/strava-token'; // Llama a nuestra Serverless Function
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, sessionId }) // sessionId used by queue gate
    });

    if (!response.ok) {
        throw new Error(`Token exchange failed: ${response.status}`);
    }

    const data = await response.json();
    return data; // Return the full object (access_token, refresh_token, expires_at)
}

// 2.5 Actualiza el token usando el refresh_token cuando el access_token expire
export async function refreshStravaToken(refreshToken) {
    const url = '/api/strava-refresh';
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            refresh_token: refreshToken
        })
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(`Token refresh failed: ${data.message || response.statusText}`);
    }
    return data; // Return the new token payload
}

// Función auxiliar para obtener el sessionId de forma segura
const getSessionId = (): string => {
    try {
        const rawData = localStorage.getItem('stravaAuth');
        if (!rawData) return 'fallback_' + Math.random().toString(36).substring(7);
        
        const parsed = JSON.parse(rawData);
        return parsed.sessionId || 'fallback';
    } catch (e) {
        return 'fallback_error';
    }
};

// 3. Obtener los entrenamientos usando el Token final
export async function fetchStravaActivities(token: string) {
    // Intentar leer de localStorage primero
    const cachedData = localStorage.getItem('stravaActivities');
    if (cachedData) {
        try {
            const parsedData = JSON.parse(cachedData);
            if (Array.isArray(parsedData) && parsedData.length > 0) {
                console.log("Cargando actividades desde localStorage");
                return parsedData;
            }
        } catch (e) {
            console.warn("Error leyendo localStorage, buscando nuevos datos", e);
        }
    }

    const sessionId = getSessionId();
    console.log(`[Strava] Fetching activities using session: ${sessionId}`);

    const response = await fetch('/api/strava-activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            access_token: token, 
            sessionId 
        })
    });

    if (!response.ok) {
        if (response.status === 401) {
            throw new Error('Unauthorized');
        }
        throw new Error(`Strava API error: ${response.status}`);
    }

    const { activities: data } = await response.json();

    // Guardar en localStorage para la próxima vez
    if (Array.isArray(data)) {
        console.log("=== STRAVA RAW PAYLOAD ===");
        if (data.length > 0) {
            console.log(JSON.stringify(data[0], null, 2));
        }
        localStorage.setItem('stravaActivities', JSON.stringify(data));

        // ✅ AUTO-LOGOUT: El token ya fue revocado en el servidor.
        // Solo limpiamos el estado local.
        localStorage.removeItem('stravaAuth');
        console.log("Session cleared locally. Slot was freed on the server.");
    }

    return data;
}

/**
 * 3.5 Obtener el detalle de una actividad (incluye splits_metric)
 */
export async function fetchDetailedActivity(token: string, activityId: number) {
    const sessionId = getSessionId();
    console.log(`[Strava] Fetching detailed activity ${activityId} using session: ${sessionId}`);

    const response = await fetch('/api/strava-activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            sessionId,
            activity_id: activityId,
            include_all_efforts: true
        })
    });

    if (!response.ok) {
        throw new Error(`Detailed Strava API error: ${response.status}`);
    }

    const { activity } = await response.json();
    return activity as DetailedActivity;
}


// Activities that have meaningful distance to display
const DISTANCE_SPORTS = new Set([
    'Run', 'VirtualRun',
    'Ride', 'VirtualRide', 'EBikeRide', 'GravelRide', 'MountainBikeRide',
    'Walk', 'Hike',
    'Swim', 'OpenWaterSwim',
]);

import { 
    formatTime, 
    formatDateShort, 
    formatDayAndNumber, 
    formatDayAndNumberNormal, 
    formatDuration, 
    getDurationValueOnly, 
    getDurationUnitOnly, 
    formatPace, 
    formatSwimPace, 
    formatSpeedKmh 
} from '../utils/formatters';

// 4. Activity stats formatter
export function formatActivityStats(activity: StravaActivity): StickerStats {
    const stats: Partial<StickerStats> = {
        id: activity.id,
        title: activity.name,
        shortTitle: activity.name.length > 22 ? activity.name.slice(0, 22) + '…' : activity.name,
        type: activity.type,
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
    const hasDistance = stats.hasDistance;

    if (hasDistance) {
        const distVal = (activity.distance / 1000).toFixed(2);
        stats.mainValue = distVal + ' km';
        stats.distanceVal = distVal;
        stats.mainLabel = 'Distance';

        if (activity.type === 'Run' || activity.type === 'VirtualRun' ||
            activity.type === 'Walk' || activity.type === 'Hike') {
            stats.subValue = formatPace(activity.average_speed);
            stats.subLabel = 'Pace';
            stats.maxPace = calculateMaxPace(activity.max_speed);
            stats.maxPaceLabel = 'Max Pace';
            stats.maxPaceUnit = 'min/km';
        } else if (activity.type === 'Swim' || activity.type === 'OpenWaterSwim') {
            stats.subValue = formatSwimPace(activity.average_speed);
            stats.subLabel = 'Pace';
            stats.maxPace = '0:00';
        } else {
            stats.subValue = formatSpeedKmh(activity.average_speed);
            stats.subLabel = 'Avg Speed';
            stats.maxPace = activity.max_speed ? (activity.max_speed * 3.6).toFixed(1) : '0.0';
            stats.maxPaceLabel = 'Max Speed';
            stats.maxPaceUnit = 'km/h';
        }
    } else {
        stats.mainValue = stats.timeStr;
        stats.distanceVal = '0.00';
        stats.maxPace = '0:00';
        stats.mainLabel = 'Duration';
        stats.subValue = activity.average_heartrate ? `${Math.round(activity.average_heartrate)} bpm` : 'Done';
        stats.subLabel = 'Avg Heartrate';
    }

    // 5. Build Dynamic Stat List (User Defined Priority)
    const points: StickerStatSlot[] = [];

    const getPaceValueOnly = (speed: number) => {
        const pace = formatPace(speed);
        return pace.split(' ')[0];
    };

    const getSpeedValueOnly = (speed: number) => {
        const s = formatSpeedKmh(speed);
        return s.split(' ')[0];
    };

    const locCity = activity.location_city || '';
    const locState = activity.location_state || '';
    let locationStr = locCity ? (locState ? `${locCity}, ${locState}` : locCity) : null;

    if (!locationStr && activity.timezone) {
        // match everything after the last slash, e.g. America/Mexico_City -> Mexico_City
        const tzMatch = activity.timezone.match(/\/(.*)$/);
        if (tzMatch) {
            locationStr = tzMatch[1].replace(/_/g, ' ');
        }
    }

    const dataPool: Record<string, StickerStatSlot | null> = {
        distance: activity.distance > 0 ? { label: 'Distance', value: (activity.distance / 1000).toFixed(2), unit: 'km' } : null,
        duration: { label: 'Duration', value: formatDuration(activity.moving_time), unit: '' },
        avg_speed: { label: 'Avg Speed', value: getSpeedValueOnly(activity.average_speed), unit: 'km/h' },
        max_speed: { label: 'Max Speed', value: getSpeedValueOnly(activity.max_speed), unit: 'km/h' },
        pace: { label: 'Pace', value: getPaceValueOnly(activity.average_speed), unit: '/km' },
        max_pace: { label: 'Max Pace', value: getPaceValueOnly(activity.max_speed), unit: '/km' },
        avg_hr: activity.average_heartrate ? { label: 'Avg HR', value: String(Math.round(activity.average_heartrate)), unit: 'bpm' } : null,
        max_hr: activity.max_heartrate ? { label: 'Max HR', value: String(Math.round(activity.max_heartrate)), unit: 'bpm' } : null,
        elev_gain: activity.total_elevation_gain ? { label: 'Elevation', value: String(Math.round(activity.total_elevation_gain)), unit: 'm' } : null,
        elev_high: activity.elev_high ? { label: 'Elev High', value: String(Math.round(activity.elev_high)), unit: 'm' } : null,
        cadence: activity.average_cadence ? { label: 'Cadence', value: String(Math.round(activity.average_cadence)), unit: 'spm' } : null,
        max_watts: activity.max_watts ? { label: 'Max Watts', value: String(Math.round(activity.max_watts)), unit: 'W' } : null,
        energy: activity.kilojoules ? { label: 'Energy', value: String(Math.round(activity.kilojoules)), unit: 'kcal' } : null,
        pr_count: activity.pr_count ? { label: 'PRs', value: String(activity.pr_count), unit: '' } : null,
        location: locationStr ? { label: 'Location', value: locationStr, unit: '' } : null,
        type: { label: 'Type', value: (activity.type === 'WeightTraining' || activity.type === 'Workout') ? 'Gym' : activity.type, unit: '' },
        name: { label: 'Name', value: stats.shortTitle || '', unit: '' },
        start_time: { label: 'Time', value: stats.startTime || '', unit: '' },
        date_long: { label: 'Date', value: formatDayAndNumberNormal(activity.start_date_local || activity.start_date), unit: '' }
    };

    let p_list: string[] = [];
    if (activity.type === 'Ride') {
        p_list = ['distance', 'avg_speed', 'duration', 'start_time', 'max_speed', 'elev_gain', 'max_hr', 'location', 'type', 'date_long', 'elev_high'];
    } else if (activity.type === 'Run' || activity.type === 'VirtualRun') {
        p_list = ['distance', 'pace', 'duration', 'start_time', 'max_pace', 'elev_gain', 'cadence', 'max_hr', 'location', 'type', 'max_watts', 'date_long', 'elev_high', 'pr_count'];
    } else if (activity.type === 'WeightTraining' || activity.type === 'Workout' || activity.type === 'Crossfit' || activity.type === 'Yoga') {
        // New Gym Priority: duration, max_hr, avg_hr, type, name, location, date_long
        p_list = ['duration', 'avg_hr', 'max_hr', 'type', 'name', 'location', 'date_long'];
    } else {
        p_list = ['duration', 'avg_hr', 'max_hr', 'type', 'name', 'location', 'date_long', 'distance'];
    }

    p_list.forEach(key => {
        const p_obj = dataPool[key];
        if (p_obj) points.push(p_obj);
    });

    while (points.length < 10) {
        points.push({ label: '', value: '-', unit: '' });
    }

    stats.dataPoints = points;

    // 6. Handle Splits for Performance Bars (if present in DetailedActivity)
    if ((activity as DetailedActivity).splits_metric) {
        const detailed = activity as DetailedActivity;
        const splits: any[] = [];
        let minSeconds = Infinity;

        detailed.splits_metric?.forEach(sm => {
            const distKm = sm.distance / 1000;
            if (distKm < 0.05) return; // Skip tiny segments

            const isFull = distKm >= 0.95; // Close enough to 1km
            const label = isFull ? String(sm.split).padStart(2, '0') : '.' + Math.round((sm.distance % 1000) / 10);
            
            const pace = formatPace(sm.average_speed);
            const paceVal = pace.split(' ')[0];
            const paceParts = paceVal.split(':');
            const seconds = parseInt(paceParts[0]) * 60 + parseInt(paceParts[1]);

            if (seconds > 0 && seconds < minSeconds) minSeconds = seconds;

            splits.push({
                type: isFull ? 'full' : 'partial',
                label,
                pace: paceVal,
                seconds
            });
        });

        stats.splits = splits;
        stats.fastestPaceSeconds = minSeconds === Infinity ? 0 : minSeconds;
        stats.deviceName = detailed.device_name;
    }

    return stats as StickerStats;
}