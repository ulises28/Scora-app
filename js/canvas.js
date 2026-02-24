/**
 * js/canvas.js - Motor de renderizado estético de Scora
 */

// Decodificador de polilíneas de Strava para obtener coordenadas [lat, lng]
export function decodePolyline(str) {
    if(!str) return [];
    let index=0, lat=0, lng=0, coordinates=[], shift=0, result=0, byte=null, latitude_change, longitude_change, factor=1e5;
    while(index<str.length){byte=null;shift=0;result=0;do{byte=str.charCodeAt(index++)-63;result|=(byte&0x1f)<<shift;shift+=5;}while(byte>=0x20);latitude_change=((result&1)?~(result>>1):(result>>1));shift=result=0;do{byte=str.charCodeAt(index++)-63;result|=(byte&0x1f)<<shift;shift+=5;}while(byte>=0x20);longitude_change=((result&1)?~(result>>1):(result>>1));lat+=latitude_change;lng+=longitude_change;coordinates.push([lat/factor,lng/factor]);}
    return coordinates;
}

export function drawTemplate(canvasId, stats, templateType = 'minimal') {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // 1. Configurar resolución estándar para Story (1080x1920)
    canvas.width = 1080;
    canvas.height = 1920;

    // 2. Fondo Negro Puro
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

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
        drawGymTemplate(ctx, stats);
    }
}

function drawRunningTemplate(ctx, stats, templateType) {
    const coords = decodePolyline(stats.polyline);
    
    // Área del mapa (ajustada para dejar aire)
    const mapBox = { x: 140, y: 350, w: 800, h: 800 }; 

    if (coords.length > 0) {
        let minLat=coords[0][0], maxLat=minLat, minLng=coords[0][1], maxLng=minLng;
        coords.forEach(p => {
            if(p[0]<minLat) minLat=p[0]; if(p[0]>maxLat) maxLat=p[0];
            if(p[1]<minLng) minLng=p[1]; if(p[1]>maxLng) maxLng=p[1];
        });
        
        const scale = Math.min(mapBox.w / (maxLng - minLng), mapBox.h / (maxLat - minLat));

        // Estilo de la ruta (Menta con Glow sutil)
        ctx.beginPath();
        ctx.strokeStyle = "#80cbc4"; 
        ctx.lineWidth = 12;
        ctx.lineCap = "round"; 
        ctx.lineJoin = "round";
        ctx.shadowColor = "rgba(128, 203, 196, 0.4)"; 
        ctx.shadowBlur = 20;

        coords.forEach((p, i) => {
            const x = mapBox.x + (p[1] - minLng) * scale + (mapBox.w - ((maxLng - minLng) * scale))/2;
            const y = mapBox.y + mapBox.h - ((p[0] - minLat) * scale) - (mapBox.h - ((maxLat - minLat) * scale))/2;
            if (i===0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.shadowBlur = 0; // Reset shadow
    }

    // --- Stats Inferiores (Aesthetic) ---
    ctx.textAlign = "center";
    
    // Valor principal (Distancia)
    ctx.font = "700 180px 'Plus Jakarta Sans'";
    ctx.fillStyle = "white";
    ctx.fillText(stats.mainValue, 540, 1400);
    
    ctx.font = "500 35px 'Plus Jakarta Sans'";
    ctx.fillStyle = "#80cbc4";
    ctx.fillText(stats.mainLabel || "kilómetros", 540, 1460);

    // Sub Stats (Ritmo y Tiempo)
    ctx.font = "600 80px 'Plus Jakarta Sans'";
    ctx.fillStyle = "white";
    ctx.fillText(stats.subValue, 330, 1650);
    ctx.fillText(stats.timeStr, 750, 1650);
    
    ctx.font = "400 30px 'Plus Jakarta Sans'";
    ctx.fillStyle = "#666";
    ctx.fillText(stats.subLabel || "ritmo", 330, 1700);
    ctx.fillText("tiempo", 750, 1700);
}

function drawGymTemplate(ctx, stats) {
    ctx.textAlign = "center";

    // Tipo de entrenamiento (Menta sutil)
    ctx.font = "600 40px 'Plus Jakarta Sans'";
    ctx.fillStyle = "#80cbc4";
    ctx.fillText(stats.title || "entrenamiento", 540, 800);

    // Valor Principal
    ctx.font = "700 220px 'Plus Jakarta Sans'";
    ctx.fillStyle = "white";
    ctx.fillText(stats.mainValue, 540, 1050);
    
    ctx.font = "500 40px 'Plus Jakarta Sans'";
    ctx.fillStyle = "#666";
    ctx.fillText(stats.mainLabel || "tiempo total", 540, 1120);

    // Valor Secundario
    ctx.font = "600 100px 'Plus Jakarta Sans'";
    ctx.fillStyle = "white";
    ctx.fillText(stats.subValue || "", 540, 1350);
    
    ctx.font = "400 35px 'Plus Jakarta Sans'";
    ctx.fillStyle = "#666";
    ctx.fillText(stats.subLabel || "", 540, 1410);
}

export function exportCanvas(canvasId) {
    const canvas = document.getElementById(canvasId);
    const link = document.createElement('a');
    link.download = `scora_${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
}