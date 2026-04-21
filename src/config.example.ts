// Vite-aware property access (Node-safe)
const env = (import.meta as any).env || {};

export const STRAVA_CONFIG = {
    // Obtén estos datos en: https://www.strava.com/settings/api
    // Vite requiere el prefijo VITE_ para exponer variables al cliente
    CLIENT_ID: env.VITE_STRAVA_CLIENT_ID || 'YOUR_STRAVA_CLIENT_ID',
    CLIENT_SECRET: env.VITE_STRAVA_CLIENT_SECRET || 'YOUR_STRAVA_CLIENT_SECRET',

    // Esta URL se generará dinámicamente según dónde estés ejecutando la app
    REDIRECT_URI: typeof window !== 'undefined' 
        ? window.location.origin + window.location.pathname.replace(/\/$/, '') 
        : 'http://localhost:5173'
};

// Diagnostic for Production
if (typeof window !== 'undefined' && !STRAVA_CONFIG.CLIENT_ID) {
    console.error(' [Scora-Config] 🚨 CRITICAL: VITE_STRAVA_CLIENT_ID is missing from the environment. Check Vercel Settings and Redeploy.');
}
