import { exchangeToken, refreshStravaToken, fetchStravaActivities, fetchDetailedActivity, deauthorizeAthlete, formatActivityStats, enrichActivityWithGeo } from './api/strava.js';
import { openStravaAuth, saveStravaAuth, createAuthPopup, redirectToStravaAuth } from './api/auth.js';
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

let currentAccessToken = '';
let currentActivityId: string | number | null = null;
let currentStats: any = null;
let lastActivities: any[] = []; // Cache for raw strava data
let queuePollingInterval: ReturnType<typeof setInterval> | null = null;

/**
 * 🕵️ IN-APP BROWSER DETECTION (Instagram/Facebook)
 * Instagram in-app browser is restrictive and often causes 403 errors during OAuth.
 * We try to "jump out" to Chrome on Android, or show a guide on iOS.
 */
function checkInAppBrowser() {
    const ua = navigator.userAgent || navigator.vendor || (window as any).opera;
    const isInstagram = ua.indexOf('Instagram') > -1;
    const isFacebook = ua.indexOf('FBAN') > -1 || ua.indexOf('FBAV') > -1;
    const isInApp = isInstagram || isFacebook;

    if (!isInApp) return false;

    // 🚀 ANDROID: Force Jump to Chrome
    if (/Android/i.test(ua)) {
        console.log("[Bridge] Android In-App detected. Attempting Chrome Intent jump...");
        const intentUrl = `intent://${window.location.host}${window.location.pathname}${window.location.search}#Intent;scheme=https;package=com.android.chrome;end`;
        window.location.href = intentUrl;
        return true;
    }

    // 🍎 iOS: Show the Bridge Guide
    console.log("[Bridge] iOS In-App detected. Showing guidance overlay.");
    const bridgeEl = document.getElementById('in-app-bridge');
    if (bridgeEl) {
        bridgeEl.classList.remove('hidden');
        
        const btnContinue = document.getElementById('btn-continue-in-app');
        if (btnContinue) {
            btnContinue.onclick = () => bridgeEl.classList.add('hidden');
        }
    }
    return true;
}

/**
 * Handle Forced Admin Reset (Liberar App)
 */
async function handleAdminReset() {
    let adminToken = localStorage.getItem('scora_admin_token');
    
    // 🔐 One-time prompt for credentials if not already cached
    const promptCredentials = () => {
        const user = prompt('Usuario Maestro (Scora):') || 'admin';
        const pass = prompt('Contraseña Maestra:');
        if (!pass) return null;
        const token = btoa(`${user}:${pass}`);
        localStorage.setItem('scora_admin_token', token);
        return token;
    };

    if (!adminToken) {
        adminToken = promptCredentials();
        if (!adminToken) return;
    }

    if (!confirm('Esto eliminará de la fila a todos los que estén esperando y liberará la conexión a Strava. ¿Continuar?')) return;
    
    try {
        const res = await fetch('/api/admin-reset', { 
            method: 'POST',
            headers: {
                'Authorization': `Basic ${adminToken}`
            }
        });

        if (res.status === 401) {
            localStorage.removeItem('scora_admin_token');
            alert('Credenciales incorrectas. Se han eliminado de la memoria. Por favor, intenta de nuevo.');
            return;
        }

        const data = await res.json();

        if (!res.ok) {
            // Handle 500 or other errors specifically
            if (data.error && data.error.includes('ADMIN_PASS')) {
                alert('⚠️ ERROR DE CONFIGURACIÓN:\n\nEl servidor no tiene configurada la contraseña maestra (ADMIN_PASS). Revisa las variables de entorno en Vercel.');
            } else {
                alert(`Error del sistema: ${data.error || 'Error desconocido'}`);
            }
            return;
        }

        // Success Cleanup
        localStorage.removeItem('stravaAuth');
        localStorage.removeItem('stravaActivities');
        
        let summary = '✅ SISTEMA REINICIADO\n\n';
        
        if (data.tokenRevoked) {
            summary += '• Conexión de Strava: Desconectada con éxito.\n';
        } else if (data.hadActiveToken) {
            summary += '• Conexión de Strava: Encontrada pero falló la desconexión auto.\n';
        }

        if (data.hadLock) {
            summary += '• Slot de conexión: Liberado.\n';
        }

        if (data.queueCleared) {
            summary += `• Fila de espera: Vaciada (${data.queueSize} usuarios eliminados).\n`;
        }

        if (data.redisMissing) {
            summary += '• Advertencia: El sistema de colas (Redis) no está configurado. No hay bloqueos que liberar.\n';
        }

        if (!data.hadLock && !data.hadActiveToken && !data.queueCleared && !data.redisMissing) {
            summary += '• Estado: No se detectaron sesiones ni bloqueos activos.\n';
        }

        summary += '\nEl sistema debería estar libre ahora. Si el error 403 persiste, el usuario afectado debe revocar el acceso manualmente en Strava.';
        
        console.log("[Admin] Reset Response:", data);
        alert(summary);
        // window.location.reload();
    } catch (e: any) {
        console.error("[Admin] Reset failure details:", e);
        alert(`Error al conectar: ${e.message}`);
    }
}


// Inicializa el Template Manager que reacciona a los clicks de usuario
const templateManager = initTemplateManager(async (template, color, showLogo) => {
    if (currentStats) {
        /* 
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
        */
        drawTemplate('storyCanvas', currentStats, template, color, showLogo);
    }
});

/**
 * Abre el editor con la actividad seleccionada (Pantalla B)
 */
function openEditor(stats: any) {
    // 0. Atomic data priming before any UI/Logic transitions
    const actIndex = lastActivities.findIndex(a => a.id === stats.id);
    stats.dayNumber = actIndex !== -1 ? (lastActivities.length - actIndex) : 1;
    
    currentStats = stats;
    currentActivityId = stats.id;

    window.history.pushState({ screen: 'screen-editor', stats }, '', '#editor');
    showScreen('screen-editor');
    
    const nameEl = document.getElementById('selected-activity-name');
    if (nameEl) nameEl.innerText = stats.shortTitle ?? stats.title;

    // 1. Synchronous template reset (triggers onChange -> first high-precision draw)
    templateManager.filterByActivity(stats);
    templateManager.setTemplate(templateManager.template);

    // 2. High-Fidelity Geographic Enrichment (Async Phase)
    // We get the raw activity from context or ID if needed.
    const rawActivity = lastActivities.find(a => a.id === stats.id);
    if (rawActivity) {
        enrichActivityWithGeo(rawActivity, stats).then(smartStats => {
            Object.assign(currentStats, smartStats);
            console.log("[Geo] Smart Enrichment complete:", currentStats.location);
            const nameEl = document.getElementById('selected-activity-name');
            if (nameEl) nameEl.innerText = currentStats.shortTitle ?? currentStats.title;
            // Force redraw with high-fidelity data
            drawTemplate('storyCanvas', currentStats, templateManager.template, templateManager.color, templateManager.showLogo);
        });
    }

    // 2. Stabilize UI for Test Runner: Brief reveal management
    const canvasEl = document.getElementById('storyCanvas');
    if (canvasEl) {
        canvasEl.style.opacity = '0';
        setTimeout(() => { canvasEl.style.opacity = '1'; }, 50);
    }
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
    lastActivities = activities; // Cache raw data for enrichment
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
                // Our turn! Use full-page REDIRECT (not popup) — Safari blocks window.open
                // calls from setInterval/setTimeout contexts (non-user-gesture).
                redirectToStravaAuth(sessionId);
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
    // 🛡️ SAFARI FIX: Initialize the popup synchronously within the user gesture
    const authPopup = createAuthPopup();

    // Show loading state immediately so the click feels instant
    if (btnLogin) {
        (btnLogin as HTMLButtonElement).disabled = true;
        btnLogin.style.cursor = 'wait';
    }

    try {
        const { position, sessionId, estimatedWait } = await joinQueue();

        if (position === 0) {
            // Slot is free — proceed directly to OAuth
            openStravaAuth(sessionId, authPopup);
        } else {
            // Show waiting room and start polling
            showScreen('screen-queue');
            updateQueueUI({ position, estimatedWait });
            
            // Close the proxy popup since we have to wait in line
            if (authPopup) authPopup.close();
            
            startQueuePolling(sessionId);
        }
    } catch (e) {
        console.error("[Queue] Failed:", e);
        if (authPopup) authPopup.close();
        alert("Ocurrió un problema al intentar conectar con el sistema. Por favor inténtalo de nuevo.");
    } finally {
        // Reset button state (in case OAuth popup was blocked or user returns)
        if (btnLogin) {
            (btnLogin as HTMLButtonElement).disabled = false;
            btnLogin.style.cursor = '';
        }
    }
}


// ============================================================
// INICIALIZACIÓN DE LA APLICACIÓN
// ============================================================

async function initApp() {
    // 🛡️ SECURITY & UX: Check if we are inside a restrictive in-app browser
    // If we just came back from Strava (authCode exists), we DON'T show the bridge 
    // to avoid interrupting the token exchange.
    const urlParams = new URLSearchParams(window.location.search);
    const authCode = urlParams.get('code');
    const stateSid = urlParams.get('state');

    if (!authCode) {
        checkInAppBrowser();
    }

    setTimeout(removeLoader, 100);

    // 👑 ADMIN BUTTON: Inject below the Strava login button whenever ?admin=scora is in the URL.
    if (urlParams.get('admin') === 'scora') {
        const existingAdmin = document.getElementById('btn-admin-reset');
        if (!existingAdmin && authSection) {
            const adminBtn = document.createElement('button');
            adminBtn.id = 'btn-admin-reset';
            adminBtn.dataset.testid = 'btn-admin-reset';
            adminBtn.className = 'btn-rescue';
            adminBtn.innerHTML = '<span>🚨</span> ADMIN: FORCE RESET';
            adminBtn.title = 'Admin: Force-reset the Strava connection slot';
            adminBtn.onclick = handleAdminReset;
            adminBtn.style.marginTop = '1rem';
            adminBtn.style.padding = '0.6rem 1rem';
            
            authSection.appendChild(adminBtn);
            document.body.classList.add('admin-mode-active');
        }
    }


    // 🔄 POPUP FLOW: Strava sent the authCode to the popup, forward it to the parent window.
    if (authCode && window.opener) {
        window.opener.postMessage({ type: 'strava_auth_success', code: authCode }, window.location.origin);
        window.close();
        return;
    }

    // 🔄 REDIRECT FLOW: User came back from Strava via full-page redirect (Safari/queue polling).
    // The authCode is in the URL but there is no opener — handle it directly.
    if (authCode && !window.opener) {
        // Clean the URL immediately so refresh doesn't re-process the code.
        window.history.replaceState({ screen: 'screen-feed' }, document.title, window.location.pathname);
        
        showScreen('screen-feed');
        if (authSection) authSection.classList.add('hidden');
        if (activitySection) activitySection.classList.remove('hidden');
        if (activityListEl) activityListEl.innerHTML = "<p class='status-msg'>Sincronizando tus rutas...</p>";
        
        try {
            // 🛡️ SESSION RECOVERY: Instagram/Safari might wipe sessionStorage on redirect.
            // We use the 'state' parameter returned by Strava as our absolute truth.
            const sid = stateSid || sessionStorage.getItem('scora_queue_session_id') || 'fallback';
            
            const tokenResponse = await exchangeToken(authCode, sid);
            saveStravaAuth(tokenResponse);
            const accessToken = tokenResponse.access_token;
            currentAccessToken = accessToken;
            const activitiesData = await fetchStravaActivities(accessToken);
            renderActivityFeed(activitiesData);
        } catch (error: any) {
            console.error("[App] Redirect auth error:", error);
            const status = error?.status;
            if (status === 403) {
                if (activityListEl) activityListEl.innerHTML = `
                    <div class="error-container">
                        <span class="error-title">⚡ SISTEMA BLOQUEADO</span>
                        <p class='error-msg'>Un atleta está ocupando la conexión. El sistema está intentando auto-recuperarse. Intenta de nuevo en 30 segundos.</p>
                    </div>`;
            } else {
                if (activityListEl) activityListEl.innerHTML = `<p class='error-msg'>Error al conectar. Por favor intenta de nuevo.</p>`;
            }
        } finally {
            if (currentAccessToken) {
                try {
                    await deauthorizeAthlete(currentAccessToken);
                    currentAccessToken = null;
                } catch (e) {
                    console.warn("[App] Redirect flow deauth failed:", e);
                }
            }
        }
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
            // 🛡️ SESSION RECOVERY: Check URL state first, then sessionStorage
            const sid = stateSid || sessionStorage.getItem('scora_queue_session_id') || 'fallback';
            const tokenResponse = await exchangeToken(authCode, sid);
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
            // DETECT 429 (RATE LIMIT) OR 500 (INTERNAL ERROR)
            const status = (error as any).status;
            if (status === 429) {
                if (activityListEl) activityListEl.innerHTML = `
                    <div class="status-msg error-msg">
                        <span>⏳</span> Rate limit exceeded. Please wait a moment before trying again.
                    </div>
                `;
            } else if (status === 500) {
                 if (activityListEl) activityListEl.innerHTML = `
                    <div class="status-msg error-msg">
                        <span>⚠️</span> Server error. Connection failed. Please try again later.
                    </div>
                `;
            } else if (status === 403 && authSection) {
                 if (activityListEl) {
                    activityListEl.innerHTML = `
                        <div class="error-container">
                            <span class="error-title">⚡ SISTEMA BLOQUEADO</span>
                            <p class='error-msg'>Un atleta está ocupando la conexión con Strava. ¿Quieres forzar la liberación para continuar?</p>
                            <button id="btn-rescue-reset" data-testid="btn-admin-reset" class="btn-rescue">
                                <span>🚨</span> EMERGENCY BUTTON
                            </button>
                        </div>
                    `;
                    const rescueBtn = document.getElementById('btn-rescue-reset');
                    if (rescueBtn) {
                        rescueBtn.onclick = async () => {
                            rescueBtn.innerHTML = "<span>⏳</span> LIBERANDO...";
                            await handleAdminReset();
                        };
                    }
                }
            } else {
                if (activityListEl) activityListEl.innerHTML = `<p class='error-msg'>Connection failed. Unexpected error occurred.</p>`;
            }
        }
    } finally {
        // 🏁 GUARANTEED CLEANUP: No matter what happened, revoke the session to unblock the next user.
        if (currentAccessToken) {
            try {
                await deauthorizeAthlete(currentAccessToken);
                console.log("[App] Session finalized correctly (Finally block).");
                currentAccessToken = null;
            } catch (e) {
                console.warn("[App] Final deauthorization failed:", e);
                localStorage.removeItem('stravaAuth');
            }
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
let copyFeedbackTimeout: ReturnType<typeof setTimeout> | null = null;
const canvasWrapper = document.querySelector('.canvas-wrapper');
if (canvasWrapper) {
    canvasWrapper.addEventListener('click', async () => {
        try {
            const canvas = document.getElementById('storyCanvas') as HTMLCanvasElement;
            if (!canvas) return;

            // Immediate Visual Feedback (Studio Precision)
            if (copyFeedbackTimeout) clearTimeout(copyFeedbackTimeout);
            canvasWrapper.classList.add('copied');
            copyFeedbackTimeout = setTimeout(() => {
                canvasWrapper.classList.remove('copied');
                copyFeedbackTimeout = null;
            }, 1500);

            // ─── SAFARI COMPATIBLE COPY ───
            // We must call navigator.clipboard.write IMMEDIATELY.
            if (typeof window.ClipboardItem !== 'undefined') {
                const imagePromise = new Promise<Blob>((resolve, reject) => {
                    canvas.toBlob((blob) => {
                        if (blob) resolve(blob);
                        else reject(new Error("Canvas toBlob failed"));
                    }, 'image/png');
                });

                const item = new window.ClipboardItem({ "image/png": imagePromise });
                await navigator.clipboard.write([item]);
                console.log("[Studio] Sticker copied to clipboard.");
            } else {
                throw new Error("ClipboardItem not supported");
            }

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
        
        // 🛡️ SESSION RECOVERY: Check for sessionId in message or fallback
        const sessionId = event.data.sessionId || sessionStorage.getItem('scora_queue_session_id') || 'fallback';

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

            window.history.replaceState({ screen: 'screen-feed' }, document.title, window.location.pathname);
        } catch (error) {
            console.error("Error en Scora Auth:", error);
            const status = (error as any).status;
            
            if (status === 429) {
                if (activityListEl) activityListEl.innerHTML = `<p class='status-msg error-msg'>Rate limit reached. Please wait.</p>`;
            } else if (status === 500) {
                if (activityListEl) activityListEl.innerHTML = `<p class='status-msg error-msg'>Internal server error. Connection failed.</p>`;
            } else if (status === 403) {
                if (activityListEl) {
                    activityListEl.innerHTML = `
                        <div class="error-container">
                            <span class="error-title">🔒 ACCESO RESTRINGIDO</span>
                            <p class='error-msg'>Se detectó una sesión activa en la pista. Como administrador, puedes liberar el sistema ahora mismo.</p>
                            <button id="btn-rescue-auth" data-testid="btn-admin-reset" class="btn-rescue">
                                <span>🚨</span> EMERGENCY BUTTON
                            </button>
                        </div>
                    `;
                    const rescueBtn = document.getElementById('btn-rescue-auth');
                    if (rescueBtn) {
                        rescueBtn.onclick = async () => {
                            rescueBtn.innerHTML = "<span>⏳</span> LIBERANDO SISTEMA...";
                            await handleAdminReset();
                        };
                    }
                }
            } else {
                if (activityListEl) activityListEl.innerHTML = `<p class='error-msg'>Connection failed. Please try again.</p>`;
            }
        } finally {
             // 🏁 GUARANTEED CLEANUP: Kill token on Strava side to unblock the 1-athlete slot.
             if (currentAccessToken) {
                 try {
                     await deauthorizeAthlete(currentAccessToken);
                     console.log("[App Auth] Session finalized (Finally block).");
                     currentAccessToken = null;
                 } catch (e) {
                     console.warn("[App Auth] Final deauth failed:", e);
                     localStorage.removeItem('stravaAuth');
                 }
             }
        }
    }
});

function sendDeauthBeacon(token: string) {
    try {
        if (navigator.sendBeacon) {
            // Using a Blob to force the Content-Type to application/json so Vercel parses req.body correctly.
            const payload = new Blob([JSON.stringify({ access_token: token })], { type: 'application/json' });
            navigator.sendBeacon('/api/strava-deauth', payload);
        } else {
            deauthorizeAthlete(token).catch(console.warn);
        }
    } catch (e) {
        console.warn('Deauth beacon failed:', e);
    }
}

// --- AUTO-LOGOUT PREVENTION (STRAVA RATE LIMIT FIX) ---
// If the user closes the app or refreshes while the 10-activity pre-fetch is still running,
// we must ensure the token is revoked so we don't hold the 1-athlete limit permanently.
window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && currentAccessToken) {
        sendDeauthBeacon(currentAccessToken);
        currentAccessToken = null;
    }
});

window.addEventListener('pagehide', () => {
    if (currentAccessToken) {
        sendDeauthBeacon(currentAccessToken);
        currentAccessToken = null;
    }
});

window.addEventListener('beforeunload', () => {
    if (currentAccessToken) {
        sendDeauthBeacon(currentAccessToken);
        currentAccessToken = null;
    }
});

// Arrancar Scora
document.addEventListener('DOMContentLoaded', initApp);