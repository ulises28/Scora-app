import { getStravaLoginUrl, exchangeToken, fetchStravaActivities, formatActivityStats } from './api.js';
import { drawTemplate, exportCanvas } from './canvas.js';

const activityListEl = document.getElementById('activity-list');
const btnDownload = document.getElementById('btn-download');

async function initApp() {
    // 1. Revisamos si en la URL viene el regalito de Strava (el 'code')
    const urlParams = new URLSearchParams(window.location.search);
    const authCode = urlParams.get('code');

    if (!authCode) {
        // SI NO HAY CÓDIGO: Mostrar botón de Login
        activityListEl.innerHTML = `
            <button id="btn-login" class="activity-btn" style="background-color:#ff5722; text-align:center; font-weight:bold;">
                Conectar con Strava
            </button>
            <p style="font-size: 12px; color: #666; margin-top:10px; text-align:center;">Para ver tus entrenamientos reales.</p>
        `;
        document.getElementById('btn-login').addEventListener('click', () => {
            window.location.href = getStravaLoginUrl(); // Manda al usuario a Strava
        });
        return; // Detenemos la ejecución aquí
    }

    // SI SÍ HAY CÓDIGO: El usuario viene de regreso de Strava
    activityListEl.innerHTML = "<p style='color: #aaa;'>Autenticando e importando datos...</p>";

    try {
        // 2. Cambiamos el código por el Token
        const accessToken = await exchangeToken(authCode);
        
        // 3. Traemos las actividades con el Token
        const activitiesData = await fetchStravaActivities(accessToken);
        
        activityListEl.innerHTML = ""; // Limpiar mensaje de carga

        // 4. Dibujar los botones
        activitiesData.forEach(act => {
            const stats = formatActivityStats(act);
            const btn = document.createElement('button');
            btn.className = 'activity-btn';
            btn.innerHTML = `<div class="activity-title">${act.name}</div><div class="activity-metric">${stats.mainValue} • ${stats.type}</div>`;
            btn.addEventListener('click', () => drawTemplate('storyCanvas', stats));
            activityListEl.appendChild(btn);
        });

        // 5. Dibujar el primer elemento por defecto
        if(activitiesData.length > 0) {
            drawTemplate('storyCanvas', formatActivityStats(activitiesData[0]));
        }

        // Limpiar la URL para que no se vea el código feo arriba (estético)
        window.history.replaceState({}, document.title, window.location.pathname);

    } catch (error) {
        activityListEl.innerHTML = `<p style='color: red;'>Error de conexión. Intenta de nuevo.</p>`;
        console.error(error);
    }

    // Configurar descarga
    btnDownload.addEventListener('click', () => exportCanvas('storyCanvas'));
}

document.addEventListener('DOMContentLoaded', initApp);