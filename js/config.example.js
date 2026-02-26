// js/config.example.js

// ⚠️ IMPORTANTE: No subas tu config.js real a un repositorio público (GitHub).
// Renombra o copia este archivo a "config.js" y pon ahí tus credenciales.

export const STRAVA_CONFIG = {
    // Obtén estos datos en: https://www.strava.com/settings/api
    CLIENT_ID: 'TU_CLIENT_ID_AQUI',
    CLIENT_SECRET: 'TU_CLIENT_SECRET_AQUI',

    // Esta URL debe coincidir con la URL de recarga donde corre tu app local
    // (Por ejemplo, http://127.0.0.1:5500 si usas Live Server en VS Code)
    REDIRECT_URI: 'http://127.0.0.1:5500'
};
