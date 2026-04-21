// js/config.example.js

// ⚠️ IMPORTANTE: No subas tu config.js real a un repositorio público (GitHub).
// Renombra o copia este archivo a "config.js" y pon ahí tus credenciales.

/** @type {any} */
const meta = import.meta;

export const STRAVA_CONFIG = {
    // Obtén estos datos en: https://www.strava.com/settings/api
    // Vite requiere el prefijo VITE_ para exponer variables al cliente
    CLIENT_ID: import.meta.env.VITE_STRAVA_CLIENT_ID,
    CLIENT_SECRET: import.meta.env.VITE_STRAVA_CLIENT_SECRET,

    // Esta URL se generará dinámicamente según dónde estés ejecutando la app
    REDIRECT_URI: typeof window !== 'undefined' 
        ? window.location.origin + window.location.pathname.replace(/\/$/, '') 
        : 'http://localhost:5173'
};

// Diagnostic for Production
if (typeof window !== 'undefined' && !STRAVA_CONFIG.CLIENT_ID) {
    console.error(' [Scora-Config] 🚨 CRITICAL: VITE_STRAVA_CLIENT_ID is missing from the environment. Check Vercel Settings and Redeploy.');
}
