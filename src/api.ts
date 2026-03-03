// IMPORTAMOS LOS SECRETOS DEL ARCHIVO DE CONFIGURACIÓN
// (Este archivo config.js no se subirá a GitHub)
import { STRAVA_CONFIG } from './config.js';
import { calculateMaxPace } from './utils/mathUtils';

// Usamos las variables importadas
const CLIENT_ID = STRAVA_CONFIG.CLIENT_ID;
const CLIENT_SECRET = STRAVA_CONFIG.CLIENT_SECRET;
const REDIRECT_URI = STRAVA_CONFIG.REDIRECT_URI;

// 1. Construye el link al que enviaremos al usuario
export function getStravaLoginUrl() {
    // Changed approval_prompt=force to auto so it doesn't ask for permission every time
    return `https://www.strava.com/oauth/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${REDIRECT_URI}&approval_prompt=auto&scope=activity:read_all`;
}

// 2. Intercambia el "code" de la URL por el Token de acceso (Lo que hacías en Postman)
export async function exchangeToken(code) {
    const url = 'https://www.strava.com/oauth/token';
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            code: code,
            grant_type: 'authorization_code'
        })
    });
    const data = await response.json();
    return data; // Return the full object (access_token, refresh_token, expires_at)
}

// 2.5 Actualiza el token usando el refresh_token cuando el access_token expire
export async function refreshStravaToken(refreshToken) {
    const url = 'https://www.strava.com/oauth/token';
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            grant_type: 'refresh_token',
            refresh_token: refreshToken
        })
    });
    const data = await response.json();
    return data; // Return the new token payload
}

// 3. Obtener los entrenamientos usando el Token final
export async function fetchStravaActivities(token) {
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

    const url = 'https://www.strava.com/api/v3/athlete/activities?per_page=5';
    const response = await fetch(url, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();

    // Guardar en localStorage para la próxima vez
    if (Array.isArray(data)) {
        console.log("=== STRAVA RAW PAYLOAD ===");
        console.log(JSON.stringify(data[0], null, 2)); // Mostramos solo el primer Run completo para no trabar la consola
        localStorage.setItem('stravaActivities', JSON.stringify(data));
    }

    return data;
}

// 4. Tu formateador de datos que ya funciona perfecto
export function formatActivityStats(activity) {
    const stats: Record<string, any> = {
        title: activity.name,
        type: activity.type,
        hasMap: !!activity.map?.summary_polyline,
        polyline: activity.map?.summary_polyline || ""
    };
    const h = Math.floor(activity.moving_time / 3600);
    const m = Math.floor((activity.moving_time % 3600) / 60);
    stats.timeStr = h > 0 ? `${h}h ${m}m` : `${m}m`;

    if (activity.type === "Run") {
        const paceSecs = Math.floor(1000 / activity.average_speed);
        const distVal = (activity.distance / 1000).toFixed(2);
        stats.mainValue = distVal + " km";
        stats.distanceVal = distVal; // Raw value for stats template

        stats.mainLabel = "DISTANCE";
        stats.subValue = `${Math.floor(paceSecs / 60)}:${(paceSecs % 60).toString().padStart(2, '0')} /km`;

        stats.maxPace = calculateMaxPace(activity.max_speed);

        stats.subLabel = "PACE";
    } else {
        stats.mainValue = stats.timeStr;
        stats.distanceVal = "0.00"; // Fallback for non-runs
        stats.maxPace = "0:00"; // Fallback for non-runs

        stats.mainLabel = "DURATION";
        stats.subValue = activity.max_heartrate ? `${activity.max_heartrate} bpm` : "Done";
        stats.subLabel = "MAX HEARTRATE";
    }
    return stats;
    return stats;
}