// js/config.example.js

// ⚠️ IMPORTANTE: No subas tu config.js real a un repositorio público (GitHub).
// Renombra o copia este archivo a "config.js" y pon ahí tus credenciales.

export const STRAVA_CONFIG = {
    // Obtén estos datos en: https://www.strava.com/settings/api
    // Vite usará las variables de entorno si existen (ej. en GitHub Actions), si no, usa el texto por defecto.
    CLIENT_ID: import.meta.env.VITE_STRAVA_CLIENT_ID || 'TU_CLIENT_ID_AQUI',
    CLIENT_SECRET: import.meta.env.VITE_STRAVA_CLIENT_SECRET || 'TU_CLIENT_SECRET_AQUI',

    // Esta URL se generará dinámicamente según dónde estés ejecutando la app
    // (Ej. http://localhost:5500, http://192.168.51.12:5500, o https://tu-app.vercel.app)
    REDIRECT_URI: typeof window !== 'undefined' ? window.location.origin + window.location.pathname.replace(/\/$/, '') : 'http://localhost:5500'
};
