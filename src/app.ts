import { exchangeToken, refreshStravaToken, fetchStravaActivities, fetchDetailedActivity, deauthorizeAthlete, formatActivityStats } from './api/strava.js';
import { openStravaAuth, saveStravaAuth } from './api/auth.js';
import { removeLoader } from './components/Loader.js';
import { showScreen } from './components/Navigation.js';
import { createActivityCard } from './components/ActivityCard.js';
import { drawTemplate, exportCanvas } from './features/editor/CanvasPainter.js';
import { initTemplateManager, TEMPLATES } from './features/editor/TemplateManager.js';
import { MOCK_ACTIVITIES } from './api/mocks.js';

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

let currentAccessToken: string | null = null;
let currentActivityId: number | null = null;
let currentStats: any = null;
let queuePollingInterval: ReturnType<typeof setInterval> | null = null;

// Inicializa el Template Manager que reacciona a los clicks de usuario
const templateManager = initTemplateManager(async (template, color, showLogo) => {
    if (currentStats) {
        // If Performance Bars is selected and we don't have splits yet, fetch detailed data
        if (template === 'performance-bars' && !currentStats.splits && currentAccessToken && currentActivityId) {
            try {
                // Show a brief loading indication if possible (optional)
                const detailed = await fetchDetailedActivity(currentAccessToken, currentActivityId);
                // Update currentStats in place with detailed info
                const detailedStats = formatActivityStats(detailed);
                Object.assign(currentStats, detailedStats);
            } catch (e) {
                console.error("Error fetching detailed activity for splits:", e);
            }
        }
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
    currentActivityId = stats.id; // Activity IDs are preserved in stats or available in formatActivityStats source

    // Reset template completely when opening a new activity to the first one in the list (Social Float)
    templateManager.setTemplate(TEMPLATES[0]);

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
    setTimeout(removeLoader, 100);

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
        if (authSection) {
            authSection.classList.remove('hidden');
            
            // 🛠️ MOCK MODE: Add a demo button if on localhost to unblock testing
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                const existingMock = document.getElementById('btn-mock-data');
                if (!existingMock) {
                    const mockBtn = document.createElement('button');
                    mockBtn.id = 'btn-mock-data';
                    mockBtn.className = 'btn-secondary';
                    mockBtn.style.marginTop = '1rem';
                    mockBtn.style.background = 'rgba(128, 203, 196, 0.1)';
                    mockBtn.style.border = '1px dashed #80cbc4';
                    mockBtn.innerHTML = '✨ Probar con Datos Demo';
                    mockBtn.onclick = () => {
                        localStorage.setItem('stravaActivities', JSON.stringify(MOCK_ACTIVITIES));
                        window.location.reload();
                    };
                    authSection.appendChild(mockBtn);
                }
            }
        }
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

    // ⚡ Optimization: Render cache immediately to make the app feel instant
    if (cachedActivities && activityListEl) {
        renderActivityFeed(JSON.parse(cachedActivities));
    } else if (activityListEl) {
        activityListEl.innerHTML = "<p class='status-msg'>Sincronizando tus rutas...</p>";
    }

    // 🛠️ DEBUG/STAGING MODE: Gated Export/Import for testing
    const isDebugEnabled = import.meta.env.VITE_ENABLE_DEBUG === 'true';
    if (isDebugEnabled && urlParams.has('debug')) {
        // 1. Export JSON Button (for Production -> Cloud transfer)
        if (cachedActivities && activitySection) {
            const existingExport = document.getElementById('btn-export-json');
            if (!existingExport) {
                const exportBtn = document.createElement('button');
                exportBtn.id = 'btn-export-json';
                exportBtn.className = 'btn-secondary';
                exportBtn.style.margin = '1rem auto';
                exportBtn.style.display = 'block';
                exportBtn.style.background = 'rgba(255, 255, 255, 0.05)';
                exportBtn.style.border = '1px solid #80cbc4';
                exportBtn.innerHTML = '📥 Exportar Actividades (JSON)';
                exportBtn.onclick = () => {
                    const blob = new Blob([cachedActivities], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `scora-activities-${new Date().toISOString().split('T')[0]}.json`;
                    a.click();
                };
                activitySection.prepend(exportBtn);
            }
        }

        // 2. Import JSON Button (for Staging site)
        if (authSection) {
            const existingImport = document.getElementById('btn-import-json-container');
            if (!existingImport) {
                const container = document.createElement('div');
                container.id = 'btn-import-json-container';
                container.style.marginTop = '1.5rem';
                container.style.textAlign = 'center';
                container.innerHTML = `
                    <label for="import-json-file" class="btn-secondary" style="display:inline-block; cursor:pointer; background:rgba(128, 203, 196, 0.1); border:1px dashed #80cbc4;">
                        📤 Importar JSON Local
                    </label>
                    <input type="file" id="import-json-file" accept=".json" style="display:none;">
                `;
                authSection.appendChild(container);
                
                const fileInput = container.querySelector('#import-json-file') as HTMLInputElement;
                fileInput.onchange = (e: any) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (re) => {
                        const content = re.target?.result as string;
                        try {
                            const parsed = JSON.parse(content);
                            if (Array.isArray(parsed)) {
                                localStorage.setItem('stravaActivities', content);
                                window.location.reload();
                            } else {
                                alert("Error: El archivo JSON no tiene el formato de Strava (debe ser un array).");
                            }
                        } catch (err) {
                            alert("Error al leer el archivo JSON.");
                        }
                    };
                    reader.readAsText(file);
                };
            }
        }
    }

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

        currentAccessToken = accessToken;

        if (accessToken) {
            // Background fetch
            activitiesData = await fetchStravaActivities(accessToken);
            // Re-render only if we got new data
            renderActivityFeed(activitiesData);
        } else {
            activitiesData = cachedActivities ? JSON.parse(cachedActivities) : [];
        }

        // Proactive pre-fetching for the last 10 activities
        if (accessToken && activitiesData.length > 0) {
            const last10 = activitiesData.slice(0, 10);
            let anyChanges = false;

            for (const act of last10) {
                // Skip if already has detailed info (like splits)
                if (act.splits) continue;

                const DISTANCE_SPORTS = ['Run', 'VirtualRun', 'Ride', 'Walk', 'Hike'];
                if (DISTANCE_SPORTS.includes(act.type)) {
                    try {
                        const detailed = await fetchDetailedActivity(accessToken!, act.id);
                        const detailedStats = formatActivityStats(detailed);
                        Object.assign(act, detailedStats);
                        anyChanges = true;
                        console.info(`[Pre-fetch] Detailed data merged for activity ${act.id}`);
                    } catch (e) {
                        console.warn(`[Pre-fetch] Failed for activity ${act.id}`, e);
                    }
                }
            }

            // Save updated detailed data back to cache so it's instant next time
            if (anyChanges) {
                localStorage.setItem('stravaActivities', JSON.stringify(activitiesData));
            }
        }

        // 🏁 FINAL STEP: Revoke token and clear session only after everything (including pre-fetch) is done
        if (accessToken) {
            try {
                await deauthorizeAthlete(accessToken);
                console.log("[App] Session finalized correctly.");
            } catch (e) {
                console.warn("[App] Final deauthorization failed:", e);
                // Even if it fails, we should clear local state to stay safe
                localStorage.removeItem('stravaAuth');
            }
        }

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

const goHomeEl = document.getElementById('go-home');
if (goHomeEl) goHomeEl.addEventListener('click', () => {
    if (window.location.hash === '#editor') {
        window.history.back();
    } else {
        showScreen('screen-feed');
    }
});

if (btnBack) btnBack.addEventListener('click', () => window.history.back());

if (btnDownload) btnDownload.addEventListener('click', () => exportCanvas('storyCanvas'));

// --- STUDIO PRECISION: Click-to-Copy Feature ---
const canvasWrapper = document.querySelector('.canvas-wrapper');
if (canvasWrapper) {
    canvasWrapper.addEventListener('click', async () => {
        try {
            const canvas = document.getElementById('storyCanvas') as HTMLCanvasElement;
            if (!canvas) return;

            // Immediate Visual Feedback (Studio Precision)
            canvasWrapper.classList.add('copied');
            setTimeout(() => canvasWrapper.classList.remove('copied'), 1500);

            canvas.toBlob(async (blob) => {
                if (!blob) return;
                try {
                    // Check for modern ClipboardItem support
                    if (typeof window.ClipboardItem !== 'undefined') {
                        const item = new window.ClipboardItem({ "image/png": blob });
                        await navigator.clipboard.write([item]);
                        
                        // Visual Feedback
                        console.log("[Studio] Sticker copied to clipboard.");
                    } else {
                        throw new Error("ClipboardItem not supported in this browser.");
                    }
                } catch (err) {
                    console.error("[Studio] Copy failed:", err);
                    alert("Sorry, your browser doesn't support direct image copying. Please use the Download button!");
                }
            });

        } catch (err) {
            console.error("[Studio] Clipboard API failed:", err);
        }
    });
}


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
            currentAccessToken = accessToken;

            const activitiesData = await fetchStravaActivities(accessToken);
            renderActivityFeed(activitiesData);

            // Proactive pre-fetching for the last 10 activities after fresh login
            if (activitiesData.length > 0) {
                const last10 = activitiesData.slice(0, 10);
                let anyChanges = false;

                for (const act of last10) {
                    if (act.splits) continue;
                    
                    const DISTANCE_SPORTS = ['Run', 'VirtualRun', 'Ride', 'Walk', 'Hike'];
                    if (DISTANCE_SPORTS.includes(act.type)) {
                        try {
                            const detailed = await fetchDetailedActivity(accessToken, act.id);
                            const detailedStats = formatActivityStats(detailed);
                            Object.assign(act, detailedStats);
                            anyChanges = true;
                            console.info(`[Pre-fetch Login] Detailed data merged for ${act.id}`);
                        } catch (e) {
                            console.warn(`[Pre-fetch Login] Failed for ${act.id}`, e);
                        }
                    }
                }

                if (anyChanges) {
                    localStorage.setItem('stravaActivities', JSON.stringify(activitiesData));
                }
            }

            // 🏁 FINAL STEP: Revoke token and clear session after login + pre-fetch
            if (accessToken) {
                try {
                    await deauthorizeAthlete(accessToken);
                    console.log("[App Login] Session finalized correctly.");
                } catch (e) {
                    console.warn("[App Login] Final deauthorization failed:", e);
                    localStorage.removeItem('stravaAuth');
                }
            }

            window.history.replaceState({ screen: 'screen-feed' }, document.title, window.location.pathname);
        } catch (error) {
            if (activityListEl) activityListEl.innerHTML = `<p class='error-msg'>No pudimos conectar con la pista. Intenta de nuevo.</p>`;
            console.error("Error en Scora Auth:", error);
        }
    }
});

// --- AUTO-LOGOUT PREVENTION (STRAVA RATE LIMIT FIX) ---
// If the user closes the app or refreshes while the 10-activity pre-fetch is still running,
// we must ensure the token is revoked so we don't hold the 1-athlete limit permanently.
window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && currentAccessToken) {
        deauthorizeAthlete(currentAccessToken).catch(console.warn);
        currentAccessToken = null;
    }
});

window.addEventListener('beforeunload', () => {
    if (currentAccessToken) {
        deauthorizeAthlete(currentAccessToken).catch(console.warn);
        currentAccessToken = null;
    }
});

// Arrancar Scora
document.addEventListener('DOMContentLoaded', initApp);