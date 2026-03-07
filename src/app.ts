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
const queuePositionEl = document.getElementById('queue-position-text');
const queueWaitEl = document.getElementById('queue-wait-text');

let currentStats: any = null;
let queuePollingInterval: ReturnType<typeof setInterval> | null = null;

// Inicializa el Template Manager que reacciona a los clicks de usuario
const templateManager = initTemplateManager((template, color, showLogo) => {
    if (currentStats) {
        drawTemplate('storyCanvas', currentStats, template, color, showLogo);
    }
});

/**
 * Abre el editor con la actividad seleccionada (Pantalla B)
 */
function openEditor(stats: any) {
    window.history.pushState({ screen: 'screen-editor', stats }, '', '#editor');
    showScreen('screen-editor');
    const nameEl = document.getElementById('selected-activity-name');
    if (nameEl) nameEl.innerText = stats.shortTitle ?? stats.title;

    currentStats = stats;

    // Reset template completely when opening a new activity
    templateManager.setTemplate('minimal');

    // Stabilize UI for Test Runner: Hide canvas during the complex drawing phase
    const canvasEl = document.getElementById('storyCanvas');
    if (canvasEl) canvasEl.style.opacity = '0';

    drawTemplate('storyCanvas', currentStats, templateManager.template, templateManager.color, templateManager.showLogo);

    // Reveal after DOM settles
    setTimeout(() => {
        if (canvasEl) canvasEl.style.opacity = '1';
    }, 50);
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

// ============================================================
// 🚦 QUEUE SYSTEM — keeps Strava's single-slot limit in order
// ============================================================

/**
 * Joins the queue. Returns { position, sessionId, estimatedWait }.
 * position === 0 means "go now", position > 0 means "wait".
 */
async function joinQueue(): Promise<{ position: number; sessionId: string; estimatedWait: number }> {
    try {
        const res = await fetch('/api/queue-join', { method: 'POST' });
        if (!res.ok) throw new Error(`Queue join failed: ${res.status}`);
        return await res.json();
    } catch (e) {
        console.warn('[Queue] Could not join queue, allowing through:', e);
        return { position: 0, sessionId: 'fallback', estimatedWait: 0 };
    }
}

/**
 * Polls queue status until it's our turn (position === 0),
 * then opens the Strava OAuth popup.
 */
function startQueuePolling(sessionId: string) {
    // Note: initial position is already set by handleLoginClick before calling this.
    // Poll every 3s to check our queue status.
    queuePollingInterval = setInterval(async () => {
        try {
            const res = await fetch(`/api/queue-status?sessionId=${encodeURIComponent(sessionId)}`);
            const data = await res.json();

            if (data.position === 0) {
                stopQueuePolling();
                // Our turn! Proceed to Strava login
                openStravaAuth(sessionId);
            } else if (data.position === -1) {
                // Session expired or already processed
                stopQueuePolling();
                showScreen('screen-feed');
                if (authSection) authSection.classList.remove('hidden');
            } else {
                updateQueueUI(data);
            }
        } catch (e) {
            console.error('[Queue] Polling error:', e);
        }
    }, 3000);
}

function stopQueuePolling() {
    if (queuePollingInterval !== null) {
        clearInterval(queuePollingInterval);
        queuePollingInterval = null;
    }
}

function updateQueueUI(data: { position: number; estimatedWait: number } | null) {
    if (queuePositionEl) {
        queuePositionEl.textContent = data ? `#${data.position}` : '#–';
    }
    if (queueWaitEl) {
        queueWaitEl.textContent = data
            ? `~${data.estimatedWait}s de espera estimada`
            : 'Calculando tiempo de espera...';
    }
}

/**
 * Handles login button click — joins queue first, then either
 * goes straight to OAuth (slot free) or shows the waiting room.
 */
async function handleLoginClick() {
    // Show loading state immediately so the click feels instant
    if (btnLogin) {
        btnLogin.textContent = 'Conectando...';
        (btnLogin as HTMLButtonElement).disabled = true;
        btnLogin.style.cursor = 'wait';
    }

    try {
        const { position, sessionId, estimatedWait } = await joinQueue();

        if (position === 0) {
            // Slot is free — proceed directly to OAuth
            openStravaAuth(sessionId);
        } else {
            // Show waiting room and start polling
            showScreen('screen-queue');
            updateQueueUI({ position, estimatedWait });
            startQueuePolling(sessionId);
        }
    } finally {
        // Reset button state (in case OAuth popup was blocked or user returns)
        if (btnLogin) {
            btnLogin.textContent = 'Conectar con Strava';
            (btnLogin as HTMLButtonElement).disabled = false;
            btnLogin.style.cursor = '';
        }
    }
}

// ============================================================
// INICIALIZACIÓN DE LA APLICACIÓN
// ============================================================

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
            btnLogin.addEventListener('click', handleLoginClick);
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
        handleLoginClick();
    });
}

// History Navigation Manager
window.addEventListener('popstate', (event) => {
    stopQueuePolling();
    if (event.state && event.state.screen) {
        showScreen(event.state.screen);
        if (event.state.screen === 'screen-editor' && event.state.stats) {
            currentStats = event.state.stats;
            const nameEl = document.getElementById('selected-activity-name');
            if (nameEl) nameEl.innerText = currentStats.shortTitle ?? currentStats.title;
            drawTemplate('storyCanvas', currentStats, templateManager.template, templateManager.color, templateManager.showLogo);
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
        const sessionId = event.data.sessionId;

        stopQueuePolling();
        showScreen('screen-feed');
        if (authSection) authSection.classList.add('hidden');
        if (activitySection) activitySection.classList.remove('hidden');
        if (activityListEl) activityListEl.innerHTML = "<p class='status-msg'>Sincronizando tus rutas...</p>";

        try {
            const tokenResponse = await exchangeToken(newCode, sessionId);
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