export function decodePolyline(str) {
    if(!str) return [];
    let index=0, lat=0, lng=0, coordinates=[], shift=0, result=0, byte=null, latitude_change, longitude_change, factor=1e5;
    while(index<str.length){byte=null;shift=0;result=0;do{byte=str.charCodeAt(index++)-63;result|=(byte&0x1f)<<shift;shift+=5;}while(byte>=0x20);latitude_change=((result&1)?~(result>>1):(result>>1));shift=result=0;do{byte=str.charCodeAt(index++)-63;result|=(byte&0x1f)<<shift;shift+=5;}while(byte>=0x20);longitude_change=((result&1)?~(result>>1):(result>>1));lat+=latitude_change;lng+=longitude_change;coordinates.push([lat/factor,lng/factor]);}
    return coordinates;
}

export function drawTemplate(canvasId, stats) {
    const canvas = document.getElementById(canvasId);
    const ctx = canvas.getContext('2d');

    // Limpiar el lienzo transparente
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Estilos generales
    ctx.textAlign = "center";
    ctx.fillStyle = "white";
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 10;

    if (stats.hasMap) {
        // DIBUJAR MAPA Y STATS DE RUNNING
        const coords = decodePolyline(stats.polyline);
        const mapBox = { x: 100, y: 300, w: 880, h: 700 }; 
        
        let minLat=coords[0][0], maxLat=minLat, minLng=coords[0][1], maxLng=minLng;
        coords.forEach(p => {
            if(p[0]<minLat) minLat=p[0]; if(p[0]>maxLat) maxLat=p[0];
            if(p[1]<minLng) minLng=p[1]; if(p[1]>maxLng) maxLng=p[1];
        });
        
        const scale = Math.min(mapBox.w / (maxLng - minLng), mapBox.h / (maxLat - minLat));

        ctx.beginPath();
        ctx.strokeStyle = "#ff5722"; // Naranja Scora
        ctx.lineWidth = 15;
        ctx.lineCap = "round"; ctx.lineJoin = "round";
        ctx.shadowColor = "rgba(0,0,0,0.6)"; ctx.shadowBlur = 20;

        coords.forEach((p, i) => {
            const x = mapBox.x + (p[1] - minLng) * scale + (mapBox.w - ((maxLng - minLng) * scale))/2;
            const y = mapBox.y + mapBox.h - ((p[0] - minLat) * scale) - (mapBox.h - ((maxLat - minLat) * scale))/2;
            if (i===0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Textos Inferiores
        ctx.shadowBlur = 10;
        ctx.shadowColor = "rgba(0,0,0,0.8)";
        ctx.font = "bold 160px sans-serif";
        ctx.fillText(stats.mainValue, 540, 1300);
        
        ctx.font = "bold 80px sans-serif";
        ctx.fillText(stats.subValue, 350, 1450);
        ctx.fillText(stats.timeStr, 730, 1450);
        
        ctx.font = "40px sans-serif";
        ctx.fillStyle = "#ddd";
        ctx.fillText(stats.subLabel, 350, 1500);
        ctx.fillText("TIME", 730, 1500);

    } else {
        // DIBUJAR TEMPLATE SIN MAPA (Pesas/Gym)
        ctx.font = "bold 80px sans-serif";
        ctx.fillStyle = "#ff5722";
        ctx.fillText(stats.title.toUpperCase(), 540, 800);

        ctx.fillStyle = "white";
        ctx.font = "bold 200px sans-serif";
        ctx.fillText(stats.mainValue, 540, 1050);
        
        ctx.font = "50px sans-serif";
        ctx.fillText(stats.mainLabel, 540, 1120);

        ctx.font = "bold 120px sans-serif";
        ctx.fillText(stats.subValue, 540, 1350);
        
        ctx.font = "40px sans-serif";
        ctx.fillStyle = "#ddd";
        ctx.fillText(stats.subLabel, 540, 1400);
    }
}

export function exportCanvas(canvasId) {
    const canvas = document.getElementById(canvasId);
    const link = document.createElement('a');
    link.download = 'scora_template.png';
    link.href = canvas.toDataURL("image/png");
    link.click();
}