import { exchangeToken, refreshStravaToken, fetchStravaActivities, formatActivityStats } from './api/strava.js';
import { openStravaAuth, saveStravaAuth } from './api/auth.js';
import { removeLoader } from './components/Loader.js';
import { showScreen } from './components/Navigation.js';
import { createActivityCard } from './components/ActivityCard.js';
import { drawTemplate, exportCanvas } from './features/editor/CanvasPainter.js';
import { initTemplateManager } from './features/editor/TemplateManager.js';

// --- ELEMENTOS DE LA INTERFAZ ---
const authSection = document.getElementById('auth-section');
const activitySection = document.getElementById('activity-section');
const activityListEl = document.getElementById('activity-list');
const btnLogin = document.getElementById('btn-login');
const btnDownload = document.getElementById('btn-download');
const btnBack = document.getElementById('btn-back');
const btnSync = document.getElementById('btn-sync');

let currentStats: any = null;

// Inicializa el Template Manager que reacciona a los clicks de usuario
const templateManager = initTemplateManager((template, color) => {
    if (currentStats) {
        drawTemplate('storyCanvas', currentStats, template, color);
    }
});

/**
 * Abre el editor con la actividad seleccionada (Pantalla B)
 */
function openEditor(stats: any) {
    window.history.pushState({ screen: 'screen-editor', stats }, '', '#editor');
    showScreen('screen-editor');
    const nameEl = document.getElementById('selected-activity-name');
    if (nameEl) nameEl.innerText = stats.title;

    currentStats = stats;
    templateManager.setTemplate(templateManager.template);
    drawTemplate('storyCanvas', currentStats, templateManager.template, templateManager.color);
}

/**
 * Renderiza las tarjetas de actividad (Pantalla A)
 */
function renderActivityFeed(activities: any[]) {
    if (!activityListEl) return;
    activityListEl.innerHTML = "";

    if (activities.length === 0) {
        activityListEl.innerHTML = "<p class='status-msg'>No hay entrenamientos recientes.</p>";
        return;
    }

    activities.forEach(act => {
        const stats = formatActivityStats(act);
        const card = createActivityCard(stats, () => openEditor(stats));
        activityListEl.appendChild(card);
    });
}

/**
 * Inicialización de la aplicación
 */
async function initApp() {
    setTimeout(removeLoader, 2000);

    const urlParams = new URLSearchParams(window.location.search);
    const authCode = urlParams.get('code');

    // Manda OAuth Data al padre y cierra popup
    if (authCode && window.opener) {
        window.opener.postMessage({ type: 'strava_auth_success', code: authCode }, window.location.origin);
        window.close();
        return;
    }

    const authDataStr = localStorage.getItem('stravaAuth');
    const authData = authDataStr ? JSON.parse(authDataStr) : null;
    const cachedActivities = localStorage.getItem('stravaActivities');

    // UI State: No sessions
    if (!authCode && !authData && !cachedActivities) {
        showScreen('screen-feed');
        if (authSection) authSection.classList.remove('hidden');
        if (activitySection) activitySection.classList.add('hidden');
        if (btnLogin) {
            btnLogin.addEventListener('click', openStravaAuth);
        }
        return;
    }

    // UI State: Valid Session
    window.history.replaceState({ screen: 'screen-feed' }, document.title, window.location.pathname);
    showScreen('screen-feed');
    if (authSection) authSection.classList.add('hidden');
    if (activitySection) activitySection.classList.remove('hidden');
    if (activityListEl) activityListEl.innerHTML = "<p class='status-msg'>Sincronizando tus rutas...</p>";

    try {
        let activitiesData;
        let accessToken = null;

        if (authCode) {
            const tokenResponse = await exchangeToken(authCode);
            saveStravaAuth(tokenResponse);
            accessToken = tokenResponse.access_token;
            window.history.replaceState({ screen: 'screen-feed' }, document.title, window.location.pathname);
        } else if (authData) {
            const nowSeconds = Math.floor(Date.now() / 1000);
            if (authData.expires_at && nowSeconds > authData.expires_at) {
                if (authData.refresh_token) {
                    const newTokenResponse = await refreshStravaToken(authData.refresh_token);
                    saveStravaAuth(newTokenResponse);
                    accessToken = newTokenResponse.access_token;
                }
            } else {
                accessToken = authData.access_token;
            }
        }

        if (accessToken) {
            activitiesData = await fetchStravaActivities(accessToken);
        } else {
            activitiesData = cachedActivities ? JSON.parse(cachedActivities) : [];
        }

        renderActivityFeed(activitiesData);

    } catch (error) {
        console.error("Error en Scora:", error);
        if (error instanceof Error && error.message === 'Unauthorized') {
            localStorage.removeItem('stravaAuth');
            localStorage.removeItem('stravaActivities');
            showScreen('screen-feed');
            if (authSection) authSection.classList.remove('hidden');
            if (activitySection) activitySection.classList.add('hidden');
            if (activityListEl) activityListEl.innerHTML = "";
        } else {
            if (activityListEl) activityListEl.innerHTML = `<p class='error-msg'>No pudimos conectar con la pista. Intenta de nuevo.</p>`;
        }
    }
}

// --- EVENT LISTENERS GLOBALES ---

if (btnBack) btnBack.addEventListener('click', () => window.history.back());
if (btnDownload) btnDownload.addEventListener('click', () => exportCanvas('storyCanvas'));

if (btnSync) {
    btnSync.addEventListener('click', () => {
        localStorage.removeItem('stravaActivities');
        if (activityListEl) activityListEl.innerHTML = "<p class='status-msg'>Conectando con Strava...</p>";
        openStravaAuth();
    });
}

// History Navigation Manager
window.addEventListener('popstate', (event) => {
    if (event.state && event.state.screen) {
        showScreen(event.state.screen);
        if (event.state.screen === 'screen-editor' && event.state.stats) {
            currentStats = event.state.stats;
            const nameEl = document.getElementById('selected-activity-name');
            if (nameEl) nameEl.innerText = currentStats.title;
            drawTemplate('storyCanvas', currentStats, templateManager.template, templateManager.color);
        }
    } else {
        showScreen('screen-feed');
    }
});

// OAuth Callback Manager
window.addEventListener('message', async (event) => {
    if (event.origin !== window.location.origin) return;

    if (event.data && event.data.type === 'strava_auth_success') {
        const newCode = event.data.code;

        showScreen('screen-feed');
        if (authSection) authSection.classList.add('hidden');
        if (activitySection) activitySection.classList.remove('hidden');
        if (activityListEl) activityListEl.innerHTML = "<p class='status-msg'>Sincronizando tus rutas...</p>";

        try {
            const tokenResponse = await exchangeToken(newCode);
            saveStravaAuth(tokenResponse);
            const accessToken = tokenResponse.access_token;

            const activitiesData = await fetchStravaActivities(accessToken);
            renderActivityFeed(activitiesData);

            window.history.replaceState({ screen: 'screen-feed' }, document.title, window.location.pathname);
        } catch (error) {
            if (activityListEl) activityListEl.innerHTML = `<p class='error-msg'>No pudimos conectar con la pista. Intenta de nuevo.</p>`;
            console.error("Error en Scora Auth:", error);
        }
    }
});

// Arrancar Scora
document.addEventListener('DOMContentLoaded', initApp);