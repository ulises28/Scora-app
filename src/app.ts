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

/**
 * Handle Forced Admin Reset (Liberar App)
 */
async function handleAdminReset() {
    let adminToken = localStorage.getItem('scora_admin_token');
    
    // 🔐 One-time prompt for credentials if not already cached
    if (!adminToken) {
        const user = prompt('Usuario Maestro (Scora):');
        const pass = prompt('Contraseña Maestra:');
        if (!user || !pass) return;
        
        // Simple base64 token (not military grade, but perfect for private usage)
        adminToken = btoa(`${user}:${pass}`);
        localStorage.setItem('scora_admin_token', adminToken);
    }

    if (!confirm('Esto eliminará de la fila a todos los que estén esperando y liberará la conexión a Strava. ¿Continuar?')) return;
    
    try {
        const res = await fetch('/api/admin-reset', { 
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });

        if (res.status === 401) {
            localStorage.removeItem('scora_admin_token');
            alert('Credenciales incorrectas. Se han eliminado de la memoria.');
            return;
        }

        const data = await res.json();
        localStorage.removeItem('stravaAuth');
        localStorage.removeItem('stravaActivities');
        
        if (data.tokenRevoked) {
            alert('¡Éxito! Sistema limpiado y usuario anterior (Beto) desconectado de Strava.');
        } else {
            alert('Sistema limpiado (cola vaciada). \n\n⚠️ IMPORTANTE: No se pudo desautorizar automáticamente porque la llave se perdió.\nSi SIGUES sin poder conectarte (Error 403), ve a Strava.com -> Ajustes -> "Mis Aplicaciones" y haz clic en "Revocar Acceso" de Scora.');
        }
        window.location.reload();
    } catch (e) {
        alert('Error al reiniciar el sistema.');
    } finally {
        // Re-enable any buttons if needed (though we reload)
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

            // 👑 ADMIN KICK BUTTON: Force Reset System (Only visible with ?admin=scora)
            if (urlParams.get('admin') === 'scora') {
                const existingAdmin = document.getElementById('btn-admin-reset');
                if (!existingAdmin) {
                    const adminBtn = document.createElement('button');
                    adminBtn.id = 'btn-admin-reset';
                    adminBtn.className = 'btn-rescue'; 
                    adminBtn.innerHTML = '<span>🚨</span> EMERGENCY BUTTON';
                    adminBtn.onclick = handleAdminReset;
                    
                    // Container for centering and distance
                    const adminContainer = document.createElement('div');
                    adminContainer.style.width = '100%';
                    adminContainer.style.display = 'flex';
                    adminContainer.style.justifyContent = 'center';
                    adminContainer.style.marginTop = '4rem'; // Generous spacing as requested
                    adminContainer.appendChild(adminBtn);
                    
                    authSection.appendChild(adminContainer);
                    
                    // Activate Admin Mode styling
                    document.body.classList.add('admin-mode-active');

                    // Also add it to the Queue screen rescue container if it exists
                    const queueRescueContainer = document.getElementById('queue-rescue-container');
                    if (queueRescueContainer) {
                        const queueAdminBtn = adminBtn.cloneNode(true) as HTMLButtonElement;
                        queueAdminBtn.onclick = handleAdminReset;
                        queueRescueContainer.appendChild(queueAdminBtn);
                    }
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
            // DETECT 403 (BETO BLOCK)
            const isRateLimit = (error as any).status === 403 || String(error).includes('403');
            if (isRateLimit && authSection) {
                 if (activityListEl) {
                    activityListEl.innerHTML = `
                        <div class="error-container">
                            <span class="error-title">⚡ SISTEMA BLOQUEADO</span>
                            <p class='error-msg'>Beto está ocupando la pista en Strava. ¿Quieres forzar su salida para continuar?</p>
                            <button id="btn-rescue-reset" class="btn-rescue">
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
                if (activityListEl) activityListEl.innerHTML = `<p class='error-msg'>No pudimos conectar con la pista. Intenta de nuevo.</p>`;
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

            window.history.replaceState({ screen: 'screen-feed' }, document.title, window.location.pathname);
        } catch (error) {
            console.error("Error en Scora Auth:", error);
            const isRateLimit = (error as any).status === 403 || String(error).includes('403');
            
            if (isRateLimit) {
                if (activityListEl) {
                    activityListEl.innerHTML = `
                        <div class="error-container">
                            <span class="error-title">🔒 ACCESO RESTRINGIDO</span>
                            <p class='error-msg'>Beto detectado en la pista. Como Administrador, puedes revocar su sesión ahora mismo.</p>
                            <button id="btn-rescue-auth" class="btn-rescue">
                                <span>🚨</span> EMERGENCY BUTTON
                            </button>
                        </div>
                    `;
                    const rescueBtn = document.getElementById('btn-rescue-auth');
                    if (rescueBtn) {
                        rescueBtn.onclick = async () => {
                            rescueBtn.innerHTML = "<span>⚔️</span> KICKING BETO...";
                            await handleAdminReset();
                        };
                    }
                }
            } else {
                if (activityListEl) activityListEl.innerHTML = `<p class='error-msg'>No pudimos conectar con la pista. Intenta de nuevo.</p>`;
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