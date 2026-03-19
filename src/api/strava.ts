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
            // Strava 'start_date_local' literally contains the wall-clock time, but might append 'Z'.
            // "2026-03-06T09:31:09Z" means the athlete read 09:31 AM on their watch.
            // Using new Date() applies the browser's timezone to it, shifting it incorrectly.
            // Split it manually to extract the exact hour/minute intended.
            try {
                const timePart = rawDate.split('T')[1].replace('Z', ''); // '09:31:09'
                const [hours, minutes] = timePart.split(':');
                let h = parseInt(hours, 10);
                const ampm = h >= 12 ? 'PM' : 'AM';
                h = h % 12 || 12;
                return `${h}:${minutes} ${ampm}`;
            } catch (e) {
                return '';
            }
        })(),
        hasDistance: DISTANCE_SPORTS.has(activity.type) && activity.distance > 0,
    };

    const h = Math.floor(activity.moving_time / 3600);
    const m = Math.floor((activity.moving_time % 3600) / 60);
    stats.timeStr = h > 0 ? `${h}h ${m}m` : `${m}m`;

    const hasDistance = DISTANCE_SPORTS.has(activity.type) && activity.distance > 0;

    if (hasDistance) {
        const distVal = (activity.distance / 1000).toFixed(2);
        stats.mainValue = distVal + ' km';
        stats.distanceVal = distVal;
        stats.mainLabel = 'Distance';

        if (activity.type === 'Run' || activity.type === 'VirtualRun' ||
            activity.type === 'Walk' || activity.type === 'Hike') {
            // Pace sports: show min/km
            const paceSecs = Math.floor(1000 / activity.average_speed);
            stats.subValue = `${Math.floor(paceSecs / 60)}:${(paceSecs % 60).toString().padStart(2, '0')} /km`;
            stats.subLabel = 'Pace';
            stats.maxPace = calculateMaxPace(activity.max_speed);
            stats.maxPaceLabel = 'Max Pace';
            stats.maxPaceUnit = 'min/km';
        } else if (activity.type === 'Swim' || activity.type === 'OpenWaterSwim') {
            // Swim pace: min/100m
            const paceSecs = Math.floor(100 / activity.average_speed);
            stats.subValue = `${Math.floor(paceSecs / 60)}:${(paceSecs % 60).toString().padStart(2, '0')} /100m`;
            stats.subLabel = 'Pace';
            stats.maxPace = '0:00'; // No max pace concept for swim
        } else {
            // Cycling & variants: show km/h average speed
            const speedKmh = (activity.average_speed * 3.6).toFixed(1);
            stats.subValue = `${speedKmh} km/h`;
            stats.subLabel = 'Avg Speed';
            // Max speed for cycling: m/s × 3.6 = km/h
            stats.maxPace = activity.max_speed ? (activity.max_speed * 3.6).toFixed(1) : '0.0';
            stats.maxPaceLabel = 'Max Speed';
            stats.maxPaceUnit = 'km/h';
        }
    } else {
        // No distance (gym, yoga, weight training, etc.)
        stats.mainValue = stats.timeStr;
        stats.distanceVal = '0.00';
        stats.maxPace = '0:00';
        stats.mainLabel = 'Duration';
        // User requested Avg Heartrate instead of Max for workouts
        stats.subValue = activity.average_heartrate ? `${Math.round(activity.average_heartrate)} bpm` : 'Done';
        stats.subLabel = 'Avg Heartrate';
    }

    return stats as StickerStats;
}