/**
 * js/canvas.js - Motor de renderizado estético de Scora
 */

// Decodificador de polilíneas de Strava para obtener coordenadas [lat, lng]
export function decodePolyline(str) {
    if (!str) return [];
    let index = 0, lat = 0, lng = 0, coordinates = [], shift = 0, result = 0, byte = null, latitude_change, longitude_change, factor = 1e5;
    while (index < str.length) { byte = null; shift = 0; result = 0; do { byte = str.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20); latitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1)); shift = result = 0; do { byte = str.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20); longitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1)); lat += latitude_change; lng += longitude_change; coordinates.push([lat / factor, lng / factor]); }
    return coordinates;
}

export function drawTemplate(canvasId, stats, templateType = 'minimal') {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // 1. Configurar resolución estándar para Story (1080x1920)
    canvas.width = 1080;
    canvas.height = 1920;

    // 2. Clear canvas for transparency (Stickers)
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 3. Branding sutil (Logo SCORA)
    ctx.textAlign = "left";
    ctx.fillStyle = "#80cbc4"; // Punto menta
    ctx.beginPath();
    ctx.arc(80, 100, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = "700 42px 'Plus Jakarta Sans'";
    ctx.fillStyle = "white";
    ctx.fillText("SCORA.", 110, 115);

    // 4. Lógica de dibujo según el tipo de actividad
    if (stats.hasMap) {
        drawRunningTemplate(ctx, stats, templateType);
    } else {
        drawGymTemplate(ctx, stats, templateType);
    }
}

function drawRunningTemplate(ctx, stats, templateType) {
    if (templateType === 'minimal') {
        drawRunningMinimal(ctx, stats);
    } else if (templateType === 'route') {
        drawRunningRoute(ctx, stats);
    } else if (templateType === 'dm') {
        drawDMBubble(ctx, stats);
    } else if (templateType === 'stats') {
        drawStatsTemplate(ctx, stats);
    } else {
        drawRunningData(ctx, stats);
    }
}

function drawGymTemplate(ctx, stats, templateType) {
    if (templateType === 'minimal' || templateType === 'route') {
        drawGymMinimal(ctx, stats);
    } else if (templateType === 'dm') {
        drawDMBubble(ctx, stats);
    } else if (templateType === 'stats') {
        drawStatsTemplate(ctx, stats);
    } else {
        drawGymData(ctx, stats);
    }
}

function drawRunningMinimal(ctx, stats) {
    ctx.textAlign = "center";

    // Titulo actividad
    ctx.font = "600 50px 'Plus Jakarta Sans'";
    ctx.fillStyle = "#80cbc4";
    ctx.fillText(stats.title || "entrenamiento", 540, 700);

    // Valor Principal
    ctx.font = "700 250px 'Plus Jakarta Sans'";
    ctx.fillStyle = "white";
    ctx.fillText(stats.mainValue, 540, 1000);

    ctx.font = "500 40px 'Plus Jakarta Sans'";
    ctx.fillStyle = "#666";
    ctx.fillText(stats.mainLabel || "kilómetros", 540, 1080);
}

function drawRunningRoute(ctx, stats) {
    const coords = decodePolyline(stats.polyline);
    drawMap(ctx, coords, { x: 90, y: 350, w: 900, h: 900 });

    ctx.textAlign = "center";
    ctx.font = "700 150px 'Plus Jakarta Sans'";
    ctx.fillStyle = "white";
    ctx.fillText(stats.mainValue, 540, 1500);

    ctx.font = "500 35px 'Plus Jakarta Sans'";
    ctx.fillStyle = "#80cbc4";
    ctx.fillText(stats.mainLabel || "kilómetros", 540, 1560);
}

function drawRunningData(ctx, stats) {
    const coords = decodePolyline(stats.polyline);
    drawMap(ctx, coords, { x: 140, y: 350, w: 800, h: 800 });

    ctx.textAlign = "center";
    ctx.font = "700 180px 'Plus Jakarta Sans'";
    ctx.fillStyle = "white";
    ctx.fillText(stats.mainValue, 540, 1400);

    ctx.font = "500 35px 'Plus Jakarta Sans'";
    ctx.fillStyle = "#80cbc4";
    ctx.fillText(stats.mainLabel || "kilómetros", 540, 1460);

    ctx.font = "600 80px 'Plus Jakarta Sans'";
    ctx.fillStyle = "white";
    ctx.fillText(stats.subValue, 330, 1650);
    ctx.fillText(stats.timeStr, 750, 1650);

    ctx.font = "400 30px 'Plus Jakarta Sans'";
    ctx.fillStyle = "#666";
    ctx.fillText(stats.subLabel || "ritmo", 330, 1700);
    ctx.fillText("tiempo", 750, 1700);
}

function drawMap(ctx, coords, mapBox) {
    if (!coords || coords.length === 0) return;
    let minLat = coords[0][0], maxLat = minLat, minLng = coords[0][1], maxLng = minLng;
    coords.forEach(p => {
        if (p[0] < minLat) minLat = p[0]; if (p[0] > maxLat) maxLat = p[0];
        if (p[1] < minLng) minLng = p[1]; if (p[1] > maxLng) maxLng = p[1];
    });

    const scale = Math.min(mapBox.w / (maxLng - minLng), mapBox.h / (maxLat - minLat));

    ctx.beginPath();
    ctx.strokeStyle = "#80cbc4";
    ctx.lineWidth = 12;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = "rgba(128, 203, 196, 0.4)";
    ctx.shadowBlur = 20;

    coords.forEach((p, i) => {
        const x = mapBox.x + (p[1] - minLng) * scale + (mapBox.w - ((maxLng - minLng) * scale)) / 2;
        const y = mapBox.y + mapBox.h - ((p[0] - minLat) * scale) - (mapBox.h - ((maxLat - minLat) * scale)) / 2;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.shadowBlur = 0;
}

function drawGymMinimal(ctx, stats) {
    ctx.textAlign = "center";
    ctx.font = "600 50px 'Plus Jakarta Sans'";
    ctx.fillStyle = "#80cbc4";
    ctx.fillText(stats.title || "entrenamiento", 540, 800);

    ctx.font = "700 220px 'Plus Jakarta Sans'";
    ctx.fillStyle = "white";
    ctx.fillText(stats.mainValue, 540, 1050);

    ctx.font = "500 40px 'Plus Jakarta Sans'";
    ctx.fillStyle = "#666";
    ctx.fillText(stats.mainLabel || "tiempo total", 540, 1120);
}

function drawGymData(ctx, stats) {
    drawGymMinimal(ctx, stats);
    ctx.font = "600 100px 'Plus Jakarta Sans'";
    ctx.fillStyle = "white";
    ctx.fillText(stats.subValue || "", 540, 1350);

    ctx.font = "400 35px 'Plus Jakarta Sans'";
    ctx.fillStyle = "#666";
    ctx.fillText(stats.subLabel || "", 540, 1410);
}

// Helper para dibujar un rectángulo con bordes redondeados
function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

// Helper para dibujar la burbuja iOS perfectamente (geométricamente solida)
function drawIOSBubble(ctx, x, y, width, height) {
    // Radio constante para la forma principal
    const r = Math.min(height * 0.45, 45);

    ctx.beginPath();

    // Esquina Superior Izquierda
    ctx.moveTo(x + r, y);

    // Borde Superior
    ctx.lineTo(x + width - r, y);
    // Curva Superior Derecha
    ctx.arcTo(x + width, y, x + width, y + r, r);

    // Borde Derecho Recto (Baja hasta justo antes del final)
    ctx.lineTo(x + width, y + height - 20);

    // --- COLITA iOS ---
    // Tail outer curve (right)
    ctx.bezierCurveTo(x + width, y + height, x + width + 10, y + height, x + width + 20, y + height);

    // Tail inner curve (left swoosh cutting back into the bubble)
    ctx.bezierCurveTo(x + width - 10, y + height - 2, x + width - 15, y + height - 15, x + width - 20, y + height - 3);

    // Borde Inferior (LÍNEA RECTA PERFECTA HACIA LA IZQUIERDA)
    ctx.lineTo(x + r, y + height);

    // Curva Inferior Izquierda
    ctx.arcTo(x, y + height, x, y + height - r, r);

    // Borde Izquierdo Recto
    ctx.lineTo(x, y + r);
    // Curva Superior Izquierda (cierra la figura)
    ctx.arcTo(x, y, x + r, y, r);

    ctx.closePath();
    ctx.fill();
}

function drawDMBubble(ctx, stats) {
    // 1. Texto de la burbuja
    let subStr = stats.subValue ? stats.subValue.replace(' /', '/') : '';
    const messageText = `${stats.mainValue}, ${subStr}`;

    const captionText = `Started 7:08 AM`;

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Fuente más grande y un poco más apretada (letter-spacing style)
    ctx.font = "normal 70px -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
    const textMetrics = ctx.measureText(messageText);
    const textWidth = textMetrics.width;

    // Dimensiones de la burbuja (Ajustadas según las proporciones reales de iMessage)
    const paddingX = 45;  // Padding horizontal
    const paddingY = 32;  // Padding vertical
    const bubbleWidth = textWidth + (paddingX * 2);
    const bubbleHeight = 135; // Altura total

    // Posicionamiento en la pantalla
    const centerX = 540;
    const centerY = 1300;
    const bubbleX = centerX - (bubbleWidth / 2);
    const bubbleY = centerY - (bubbleHeight / 2);

    // 1. Burbuja Azul
    ctx.fillStyle = "#0a7cff"; // Exact iMessage Blue
    drawIOSBubble(ctx, bubbleX, bubbleY, bubbleWidth, bubbleHeight);

    // 2. Texto del mensaje
    ctx.fillStyle = "white";
    ctx.font = "normal 70px -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
    ctx.fillText(messageText, centerX, centerY + 3);

    // 3. Texto pequeño debajo (Status)
    ctx.textAlign = "right";
    ctx.font = "500 35px -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    ctx.fillText(captionText, bubbleX + bubbleWidth - 5, centerY + (bubbleHeight / 2) + 40);
}

function drawStatsTemplate(ctx, stats) {
    // --- 1. Distancia (Mitad superior) ---
    const distanceY = 700;

    // Obtenemos los textos
    const distText = stats.distanceVal || "0.00";
    const unitText = "km";
    const labelText = "Distance";

    // Configuramos fuentes para medir (Reducidas para que quepan en 1080px)
    const fontDist = "800 280px 'Plus Jakarta Sans'";
    const fontUnit = "700 220px 'Plus Jakarta Sans'";
    const fontLabel = "600 50px 'Plus Jakarta Sans'";

    // Medimos para centrar el bloque principal en la línea base normal
    ctx.textBaseline = "alphabetic";

    ctx.font = fontDist;
    const distWidth = ctx.measureText(distText).width;

    ctx.font = fontUnit;
    const unitWidth = ctx.measureText(unitText).width;

    // Mismo baseline, distancia corta
    const gap = 15;
    const totalDistWidth = distWidth + gap + unitWidth;
    const startX = 540 - (totalDistWidth / 2);

    // Dibujamos el número de distancia
    ctx.textAlign = "left";

    ctx.font = fontDist;
    ctx.fillStyle = "rgba(255, 255, 255, 0.45)"; // Blanco con más transparencia
    ctx.fillText(distText, startX, distanceY);

    // Dibujamos "km" justo al lado
    ctx.font = fontUnit;
    ctx.fillStyle = "white"; // Sólido
    ctx.fillText(unitText, startX + distWidth + gap, distanceY);

    // Etiqueta "Distance" debajo y centrada
    ctx.textAlign = "center";
    ctx.font = fontLabel;
    ctx.fillStyle = "white"; // Sólido
    ctx.fillText(labelText, 540, distanceY + 70);

    // --- 2. Pace Máximo (Centro) ---
    const paceY = 1050; // Subiendo el conjunto de pace más cerca del centro
    const paceText = stats.maxPace ? stats.maxPace.replace(' /', '') : "0:00";
    const paceUnit = "km/min";
    const paceLabel = "MAX PACE";

    const fontPace = "800 120px 'Plus Jakarta Sans'"; // Reducido para encajar
    const fontPaceUnit = "700 60px 'Plus Jakarta Sans'"; // Unidad mucho más chica en pace
    const fontPaceLabel = "600 35px 'Plus Jakarta Sans'";

    // Medimos el pace
    ctx.font = fontPace;
    const paceWidth = ctx.measureText(paceText).width;

    ctx.font = fontPaceUnit;
    const paceUnitWidth = ctx.measureText(paceUnit).width;

    const paceGap = 10;
    const totalPaceWidth = paceWidth + paceGap + paceUnitWidth;
    const startPaceX = 540 - (totalPaceWidth / 2);

    // Dibujamos el valor de max pace
    ctx.textAlign = "left";
    ctx.font = fontPace;
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)"; // 20% transparencia (Blanco está bien aquí para contraste)
    ctx.fillText(paceText, startPaceX, paceY);

    // Dibujamos "km/min" en el mismo bloque horizontal
    ctx.font = fontPaceUnit;
    ctx.fillStyle = "white"; // Sólido
    ctx.fillText(paceUnit, startPaceX + paceWidth + paceGap, paceY);

    // Dibujar la etiqueta "MAX PACE" abajo, alineada al centro
    ctx.textAlign = "center";
    ctx.font = fontPaceLabel;
    ctx.fillStyle = "white";
    // Lo ubicamos debajo de los números
    ctx.fillText(paceLabel, 540, paceY + 60);
}

export function exportCanvas(canvasId) {
    const canvas = document.getElementById(canvasId);
    const link = document.createElement('a');
    link.download = `scora_${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
}