import { getStravaLoginUrl, exchangeToken, fetchStravaActivities, formatActivityStats } from './api.js';
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
 * Inicialización de la aplicación
 */
async function initApp() {
    // 1. Quitamos la pista de bienvenida tras un breve delay para que se aprecie
    setTimeout(removeLoader, 2000);

    const urlParams = new URLSearchParams(window.location.search);
    const authCode = urlParams.get('code');

    // 2. ESCENARIO A: El usuario no está conectado
    if (!authCode) {
        showScreen('screen-feed');
        authSection.classList.remove('hidden');
        activitySection.classList.add('hidden');

        btnLogin.addEventListener('click', () => {
            window.location.href = getStravaLoginUrl();
        });
        return;
    }

    // 3. ESCENARIO B: El usuario regresó de Strava con éxito
    showScreen('screen-feed');
    authSection.classList.add('hidden');
    activitySection.classList.remove('hidden');
    activityListEl.innerHTML = "<p class='status-msg'>Sincronizando tus rutas...</p>";

    try {
        const accessToken = await exchangeToken(authCode);
        const activitiesData = await fetchStravaActivities(accessToken);
        
        renderActivityFeed(activitiesData);

        // Limpiamos la URL para que se vea profesional (sin el código de Strava)
        window.history.replaceState({}, document.title, window.location.pathname);

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
    drawTemplate('storyCanvas', stats); 
}

// --- EVENT LISTENERS GLOBALES ---

btnBack.addEventListener('click', () => showScreen('screen-feed'));
btnDownload.addEventListener('click', () => exportCanvas('storyCanvas'));

// Manejo de selección de templates
document.querySelectorAll('.template-item').forEach(item => {
    item.addEventListener('click', (e) => {
        document.querySelector('.template-item.active')?.classList.remove('active');
        e.target.classList.add('active');
        // Aquí puedes añadir lógica para redibujar el canvas con el nuevo estilo
    });
});

// Arrancar Scora
document.addEventListener('DOMContentLoaded', initApp);