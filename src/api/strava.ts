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
    pr_count?: number;
    start_date_local: string;
    start_date: string;
    map?: {
        summary_polyline: string;
    };
}

export interface StickerStatSlot {
    label: string;
    value: string;
    unit: string;
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
    maxPace: string;
    maxPaceLabel: string;
    maxPaceUnit: string;
    dataPoints: StickerStatSlot[];
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

// Activities that have meaningful distance to display
const DISTANCE_SPORTS = new Set([
    'Run', 'VirtualRun',
    'Ride', 'VirtualRide', 'EBikeRide', 'GravelRide', 'MountainBikeRide',
    'Walk', 'Hike',
    'Swim', 'OpenWaterSwim',
]);

// 4. Activity stats formatter
export function formatActivityStats(activity: StravaActivity): StickerStats {
    const stats: Partial<StickerStats> = {
        title: activity.name,
        // Nav header version: truncated to 15 chars so it never overflows
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
                const timePart = rawDate.split('T')[1].replace('Z', ''); // '09:31:09'
                const [hours, minutes] = timePart.split(':');
                let h = parseInt(hours, 10);
                const ampm = h >= 12 ? 'PM' : 'AM';
                h = h % 12 || 12;
                return `${h}:${minutes} ${ampm}`;
            } catch (e) { return ''; }
        })(),
        date: (() => {
            const rawDate = activity.start_date_local || activity.start_date;
            if (!rawDate) return '';
            try {
                const datePart = rawDate.split('T')[0]; // '2026-03-06'
                const [year, month, day] = datePart.split('-');
                const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
                const mIdx = parseInt(month, 10) - 1;
                return `${months[mIdx]} ${day}`;
            } catch (e) { return ''; }
        })(),
        dayAndNumber: (() => {
            const rawDate = activity.start_date_local || activity.start_date;
            if (!rawDate) return '';
            try {
                const datePart = rawDate.split('T')[0];
                const d = new Date(datePart + 'T12:00:00');
                const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
                const dayName = dayNames[d.getDay()];
                const dayNum = String(d.getDate()).padStart(2, '0');
                return `${dayName} ${dayNum}`;
            } catch (e) { return ''; }
        })(),
        hasDistance: DISTANCE_SPORTS.has(activity.type) && activity.distance > 0,
    };

    const h_total = Math.floor(activity.moving_time / 3600);
    const m_total = Math.floor((activity.moving_time % 3600) / 60);
    stats.timeStr = h_total > 0 ? `${h_total}h ${m_total}m` : `${m_total}m`;

    const hasDistance = stats.hasDistance;

    if (hasDistance) {
        const distVal = (activity.distance / 1000).toFixed(2);
        stats.mainValue = distVal + ' km';
        stats.distanceVal = distVal;
        stats.mainLabel = 'Distance';

        if (activity.type === 'Run' || activity.type === 'VirtualRun' ||
            activity.type === 'Walk' || activity.type === 'Hike') {
            const paceSecs = Math.floor(1000 / activity.average_speed);
            stats.subValue = `${Math.floor(paceSecs / 60)}:${(paceSecs % 60).toString().padStart(2, '0')} /km`;
            stats.subLabel = 'Pace';
            stats.maxPace = calculateMaxPace(activity.max_speed);
            stats.maxPaceLabel = 'Max Pace';
            stats.maxPaceUnit = 'min/km';
        } else if (activity.type === 'Swim' || activity.type === 'OpenWaterSwim') {
            const paceSecs = Math.floor(100 / activity.average_speed);
            stats.subValue = `${Math.floor(paceSecs / 60)}:${(paceSecs % 60).toString().padStart(2, '0')} /100m`;
            stats.subLabel = 'Pace';
            stats.maxPace = '0:00';
        } else {
            const speedKmh = (activity.average_speed * 3.6).toFixed(1);
            stats.subValue = `${speedKmh} km/h`;
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

    const getFormattedDay = (raw: string) => {
        try {
            const datePart = raw.split('T')[0];
            const d = new Date(datePart + 'T12:00:00');
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const dayName = dayNames[d.getDay()];
            const dayNum = String(d.getDate()).padStart(2, '0');
            return `${dayName} ${dayNum}`;
        } catch (e) { return ''; }
    };

    const formatDuration = (secs: number) => {
        const h_val = Math.floor(secs / 3600);
        const m_val = Math.floor((secs % 3600) / 60);
        return h_val > 0 ? `${h_val}h ${m_val}m` : `${m_val}m`;
    };

    const getPaceStr = (speed: number) => {
        if (!speed || speed <= 0) return '0:00';
        const paceSecs = Math.floor(1000 / speed);
        return `${Math.floor(paceSecs / 60)}:${(paceSecs % 60).toString().padStart(2, '0')}`;
    };

    const getSpeedKmh = (speed: number) => (speed * 3.6).toFixed(1);

    const locCity = activity.location_city || '';
    const locState = activity.location_state || '';
    const locationStr = locCity ? (locState ? `${locCity}, ${locState}` : locCity) : null;

    const dataPool: Record<string, StickerStatSlot | null> = {
        distance: activity.distance > 0 ? { label: 'Distance', value: (activity.distance / 1000).toFixed(2), unit: 'km' } : null,
        duration: { label: 'Duration', value: formatDuration(activity.moving_time), unit: '' },
        avg_speed: { label: 'Avg Speed', value: getSpeedKmh(activity.average_speed), unit: 'km/h' },
        max_speed: { label: 'Max Speed', value: getSpeedKmh(activity.max_speed), unit: 'km/h' },
        pace: { label: 'Pace', value: getPaceStr(activity.average_speed), unit: '/km' },
        max_pace: { label: 'Max Pace', value: getPaceStr(activity.max_speed), unit: '/km' },
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
        date_long: { label: 'Date', value: getFormattedDay(activity.start_date_local || activity.start_date), unit: '' }
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

    return stats as StickerStats;
}