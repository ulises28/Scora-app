import { getStravaLoginUrl, exchangeToken, refreshStravaToken, fetchStravaActivities, formatActivityStats } from './api.js';
import { drawTemplate, exportCanvas } from './canvas.js';

// --- ELEMENTOS DE LA INTERFAZ ---
const loaderOverlay = document.getElementById('loader-overlay');
const screenFeed = document.getElementById('screen-feed');
const screenEditor = document.getElementById('screen-editor');
const authSection = document.getElementById('auth-section');
const activitySection = document.getElementById('activity-section');
const activityListEl = document.getElementById('activity-list');

const btnLogin = document.getElementById('btn-login');
const btnDownload = document.getElementById('btn-download');
const btnBack = document.getElementById('btn-back');
const btnSync = document.getElementById('btn-sync');

let currentStats = null;
let currentTemplate = 'minimal';
let currentTextColor = 'white';

/**
 * Función para ocultar la imagen de bienvenida (Loader)
 */
function removeLoader() {
    if (loaderOverlay) {
        loaderOverlay.classList.add('hidden');
        // Eliminamos del DOM después de la transición para optimizar
        setTimeout(() => loaderOverlay.remove(), 800);
    }
}

/**
 * Helper para guardar/actualizar los tokens en localStorage
 */
function saveStravaAuth(tokenData) {
    // tokenData expected to have: access_token, refresh_token, expires_at
    if (tokenData && tokenData.access_token) {
        localStorage.setItem('stravaAuth', JSON.stringify({
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expires_at: tokenData.expires_at
        }));
    }
}

/**
 * Inicialización de la aplicación
 */
async function initApp() {
    setTimeout(removeLoader, 2000);

    const urlParams = new URLSearchParams(window.location.search);
    const authCode = urlParams.get('code');

    const authDataStr = localStorage.getItem('stravaAuth');
    let authData = authDataStr ? JSON.parse(authDataStr) : null;
    const cachedActivities = localStorage.getItem('stravaActivities');

    // Mismo proceso: si no hay código nuevo, ni tokens guardados, ni datos en caché, mostrar Login
    if (!authCode && !authData && !cachedActivities) {
        showScreen('screen-feed');
        authSection.classList.remove('hidden');
        activitySection.classList.add('hidden');

        btnLogin.addEventListener('click', () => {
            window.location.href = getStravaLoginUrl();
        });
        return;
    }

    // Hay código, tokens o caché. Mostrar la pantalla principal.
    showScreen('screen-feed');
    authSection.classList.add('hidden');
    activitySection.classList.remove('hidden');
    activityListEl.innerHTML = "<p class='status-msg'>Sincronizando tus rutas...</p>";

    try {
        let activitiesData;
        let accessToken = null;

        if (authCode) {
            // El usuario acaba de ser redirigido desde Strava
            const tokenResponse = await exchangeToken(authCode);
            saveStravaAuth(tokenResponse);
            accessToken = tokenResponse.access_token;

            // Limpiar la URL
            window.history.replaceState({}, document.title, window.location.pathname);
        } else if (authData) {
            // Ya teníamos tokens. Verificamos si expiraron
            const nowSeconds = Math.floor(Date.now() / 1000);
            if (authData.expires_at && nowSeconds > authData.expires_at) {
                console.log("Token expirado. Refrescando...");
                if (authData.refresh_token) {
                    const newTokenResponse = await refreshStravaToken(authData.refresh_token);
                    saveStravaAuth(newTokenResponse);
                    accessToken = newTokenResponse.access_token;
                }
            } else {
                console.log("Token aún válido.");
                accessToken = authData.access_token;
            }
        }

        if (accessToken) {
            activitiesData = await fetchStravaActivities(accessToken);
        } else {
            // Fallback a caché si fallaron los tokens pero tenemos actividades
            activitiesData = cachedActivities ? JSON.parse(cachedActivities) : [];
        }

        renderActivityFeed(activitiesData);

    } catch (error) {
        activityListEl.innerHTML = `<p class='error-msg'>No pudimos conectar con la pista. Intenta de nuevo.</p>`;
        console.error("Error en Scora:", error);
    }
}

/**
 * Renderiza las tarjetas de actividad (Pantalla A)
 */
function renderActivityFeed(activities) {
    activityListEl.innerHTML = "";

    if (activities.length === 0) {
        activityListEl.innerHTML = "<p class='status-msg'>No hay entrenamientos recientes.</p>";
        return;
    }

    activities.forEach(act => {
        const stats = formatActivityStats(act);
        const card = document.createElement('div');
        card.className = 'activity-card';
        card.innerHTML = `
            <div class="card-info">
                <span class="card-title">${act.name}</span>
                <span class="card-meta">${stats.mainValue} • ${stats.type}</span>
            </div>
            <span class="card-arrow">→</span>
        `;

        card.addEventListener('click', () => openEditor(stats));
        activityListEl.appendChild(card);
    });
}

/**
 * Cambia entre pantallas (SPA Logic)
 */
function showScreen(screenId) {
    screenFeed.classList.remove('active');
    screenEditor.classList.remove('active');
    document.getElementById(screenId).classList.add('active');
}

/**
 * Abre el editor con la actividad seleccionada (Pantalla B)
 */
function openEditor(stats) {
    showScreen('screen-editor');
    document.getElementById('selected-activity-name').innerText = stats.title;

    currentStats = stats;
    // Seleccionar visualmente el template actual
    document.querySelectorAll('.template-item').forEach(item => {
        if ((item as HTMLElement).innerText.trim().toLowerCase() === currentTemplate) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    drawTemplate('storyCanvas', currentStats, currentTemplate, currentTextColor);
}

// --- EVENT LISTENERS GLOBALES ---

btnBack.addEventListener('click', () => showScreen('screen-feed'));
btnDownload.addEventListener('click', () => exportCanvas('storyCanvas'));

if (btnSync) {
    btnSync.addEventListener('click', () => {
        // Limpiamos el cache
        localStorage.removeItem('stravaActivities');

        // Mostrar estado de carga visualmente
        activityListEl.innerHTML = "<p class='status-msg'>Conectando con Strava...</p>";

        // Redirigir a Strava para un nuevo token
        window.location.href = getStravaLoginUrl();
    });
}

// Manejo de selección de templates
document.querySelectorAll('.template-item').forEach(item => {
    item.addEventListener('click', (e) => {
        document.querySelector('.template-item.active')?.classList.remove('active');
        (e.target as HTMLElement).classList.add('active');

        currentTemplate = (e.target as HTMLElement).innerText.trim().toLowerCase();
        if (currentStats) {
            drawTemplate('storyCanvas', currentStats, currentTemplate, currentTextColor);
        }
    });
});

// Manejo de color de texto
const textColorSelect = document.getElementById('text-color-select');
if (textColorSelect) {
    textColorSelect.addEventListener('change', (e) => {
        currentTextColor = (e.target as HTMLSelectElement).value;
        if (currentStats) {
            drawTemplate('storyCanvas', currentStats, currentTemplate, currentTextColor);
        }
    });
}

// Arrancar Scora
document.addEventListener('DOMContentLoaded', initApp);