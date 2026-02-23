// IMPORTAMOS LOS SECRETOS DEL ARCHIVO DE CONFIGURACIÓN
// (Este archivo config.js no se subirá a GitHub)
import { STRAVA_CONFIG } from './config.js';

// Usamos las variables importadas
const CLIENT_ID = STRAVA_CONFIG.CLIENT_ID;
const CLIENT_SECRET = STRAVA_CONFIG.CLIENT_SECRET;
const REDIRECT_URI = STRAVA_CONFIG.REDIRECT_URI;

// 1. Construye el link al que enviaremos al usuario
export function getStravaLoginUrl() {
    return `https://www.strava.com/oauth/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${REDIRECT_URI}&approval_prompt=force&scope=activity:read_all`;
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
    return data.access_token; // Este es el token final que necesitamos
}

// 3. Obtener los entrenamientos usando el Token final
export async function fetchStravaActivities(token) {
    const url = 'https://www.strava.com/api/v3/athlete/activities?per_page=5';
    const response = await fetch(url, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return await response.json();
}

// 4. Tu formateador de datos que ya funciona perfecto
export function formatActivityStats(activity) {
    const stats = {
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
        stats.mainValue = (activity.distance / 1000).toFixed(2) + " km";
        stats.mainLabel = "DISTANCE";
        stats.subValue = `${Math.floor(paceSecs / 60)}:${(paceSecs % 60).toString().padStart(2, '0')} /km`;
        stats.subLabel = "PACE";
    } else {
        stats.mainValue = stats.timeStr;
        stats.mainLabel = "DURATION";
        stats.subValue = activity.average_heartrate ? `${activity.average_heartrate} bpm` : "Done";
        stats.subLabel = "EFFORT";
    }
    return stats;
}