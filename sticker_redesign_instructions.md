# Scora Canvas Templates Redesign & Italics Purge Instructions

This document lists the exact changes to be applied to `src/features/editor/CanvasPainter.ts` to implement the visual redesign and completely strip all italic fonts.

---

## 1. Complete Italics Sweeper
Replace any occurrences of `italic ` in active font strings with upright font styles (remove the word `italic` completely). Below are the specific font rules:

### drawChatSticker
*   **Target (around line 1185)**:
    ```typescript
    ctx.font = `italic 900 130px ${sysFont}`;
    ```
*   **Replacement**:
    ```typescript
    ctx.font = `900 130px ${sysFont}`;
    ```

### drawDataModular
*   **Target (around line 1569 and 1580)**:
    ```typescript
    ctx.font = `italic 900 60px ${sysFont}`;
    ```
*   **Replacement**:
    ```typescript
    ctx.font = `900 60px ${sysFont}`;
    ```

### drawClassicStack
*   **Target (around lines 5143-5166)**:
    ```typescript
    ctx.font = `italic 900 320px ${sysFont}`;
    ...
    ctx.font = `italic 900 140px ${sysFont}`;
    ...
    ctx.font = `italic 900 58px ${sysFont}`;
    ```
*   **Replacement**:
    ```typescript
    ctx.font = `900 320px ${sysFont}`;
    ...
    ctx.font = `900 140px ${sysFont}`;
    ...
    ctx.font = `900 58px ${sysFont}`;
    ```

### drawNeonSlanted
*   **Target (around lines 5210-5235)**:
    ```typescript
    ctx.font = `italic 900 85px ${sysFont}`;
    ...
    ctx.font = `italic 900 ${fontSize}px ${sysFont}`;
    ```
*   **Replacement**:
    ```typescript
    ctx.font = `900 85px ${sysFont}`;
    ...
    ctx.font = `900 ${fontSize}px ${sysFont}`;
    ```

### drawAestheticMedal
*   **Target (around lines 5296-5326)**:
    ```typescript
    ctx.font = `italic 900 ${fontSize}px ${sysFont}`;
    ```
*   **Replacement**:
    ```typescript
    ctx.font = `900 ${fontSize}px ${sysFont}`;
    ```

### drawEditorialStrip
*   **Target (around lines 2435, 2448)**:
    ```typescript
    ctx.font = `italic 900 52px ${sysFont}`;
    ```
*   **Replacement**:
    ```typescript
    ctx.font = `900 52px ${sysFont}`;
    ```

### drawUltraDetail
*   **Target (around lines 5917, 5928, 5940)**:
    ```typescript
    ctx.font = `italic 900 ${heroFontSize}px 'Russo One'`;
    ...
    ctx.font = `italic 900 56px 'Russo One'`;
    ```
*   **Replacement**:
    ```typescript
    ctx.font = `900 ${heroFontSize}px 'Russo One'`;
    ...
    ctx.font = `900 56px 'Russo One'`;
    ```

---

## 2. Redesign Implementation Code Blocks

### A. drawNoteAccentSticker (Liquid Glass Context Menu)
Replace the context menu drawing section (starting around `// 8. SCORA V18 "ACTION MENU"`) with the following beveled liquid glass style:
```typescript
    // 8. SCORA V18 "ACTION MENU" (The Floating Context Menu)
    // Replicating the "Liquid Glass Effect" (Glossy Gradient + Specular Highlights + Beveled Edge)
    ctx.restore();
    ctx.save();

    const menuW = 920;
    const menuH = 135;
    const menuX = 540 - (menuW / 2);
    const menuY = yBaseline + 160;

    // A. Outer Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 35;
    ctx.shadowOffsetY = 15;

    // B. Base Liquid Glass Gradient Fill
    const baseGrad = ctx.createLinearGradient(menuX, menuY, menuX, menuY + menuH);
    const isLightTheme = textColor === 'black';
    if (isLightTheme) {
        baseGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
        baseGrad.addColorStop(0.3, 'rgba(240, 240, 245, 0.65)');
        baseGrad.addColorStop(1, 'rgba(225, 225, 230, 0.85)');
    } else {
        baseGrad.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
        baseGrad.addColorStop(0.3, 'rgba(35, 35, 40, 0.65)');
        baseGrad.addColorStop(1, 'rgba(15, 15, 18, 0.85)');
    }

    ctx.fillStyle = baseGrad;
    ctx.beginPath();
    ctx.roundRect(menuX, menuY, menuW, menuH, menuH / 2);
    ctx.fill();

    // Disable shadow for internal drawings to avoid double-shadowing
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // C. Specular Highlight / Glossy Top Half
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(menuX, menuY, menuW, menuH, menuH / 2);
    ctx.clip();
    
    const glossGrad = ctx.createLinearGradient(menuX, menuY, menuX, menuY + menuH / 2);
    glossGrad.addColorStop(0, isLightTheme ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.35)');
    glossGrad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = glossGrad;
    ctx.fillRect(menuX, menuY, menuW, menuH / 2);
    ctx.restore();

    // D. Glossy Beveled Edge (Gradient Stroke)
    const borderGrad = ctx.createLinearGradient(menuX, menuY, menuX, menuY + menuH);
    if (isLightTheme) {
        borderGrad.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
        borderGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.3)');
        borderGrad.addColorStop(1, 'rgba(0, 0, 0, 0.12)');
    } else {
        borderGrad.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
        borderGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.15)');
        borderGrad.addColorStop(1, 'rgba(255, 255, 255, 0.05)');
    }
    ctx.strokeStyle = borderGrad;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Draw Subtle Dividers
    const dividerColor = isLightTheme ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.1)';
    ctx.strokeStyle = dividerColor;
    ctx.lineWidth = 2;

    const items = ['Cut', 'Copy', 'Paste', 'AutoFill'];
    const sectionW = (menuW - 120) / items.length;

    for (let i = 1; i < items.length; i++) {
        const dX = menuX + (i * sectionW) + 20;
        ctx.beginPath();
        ctx.moveTo(dX, menuY + 35);
        ctx.lineTo(dX, menuY + menuH - 35);
        ctx.stroke();
    }

    // Draw Menu Labels
    const labelColor = isLightTheme ? '#111111' : '#ffffff';
    ctx.fillStyle = labelColor;
    ctx.font = `500 42px 'Plus Jakarta Sans'`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    items.forEach((item, i) => {
        const tX = menuX + (i * sectionW) + (sectionW / 2) + 20;
        ctx.fillText(item, tX, menuY + (menuH / 2));
    });

    // Draw the Selection Arrow (Symmetric section)
    ctx.font = `600 48px 'Plus Jakarta Sans'`;
    ctx.fillText('>', menuX + menuW - 65, menuY + (menuH / 2) - 2);

    ctx.restore();
```

### B. Revert drawGraffitiExpo to Master (No Bounding Card Box)
Replace `drawGraffitiExpo` completely with the following:
```typescript
export function drawGraffitiExpo(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    const { solid, trans, label: labelColor, accent: accentColor } = buildColors(textColor);

    const lineColor = textColor.startsWith('#') ? textColor : (textColor === 'black' ? '#000000' : '#ffffff');
    const secondaryColor = textColor === 'black' ? '#000000' : '#ffffff';

    // 1. Enhanced Spray Map (Higher, leave space for text)
    if (stats.polyline) {
        const coords = decodePolyline(stats.polyline);
        if (coords && coords.length > 0) {
            const mapBox = { x: 100, y: 150, w: 880, h: 1050 };

            let minLat = coords[0][0], maxLat = minLat, minLng = coords[0][1], maxLng = minLng;
            coords.forEach((p: any) => {
                if (p[0] < minLat) minLat = p[0]; if (p[0] > maxLat) maxLat = p[0];
                if (p[1] < minLng) minLng = p[1]; if (p[1] > maxLng) maxLng = p[1];
            });

            const scale = Math.min(mapBox.w / (maxLng - minLng), mapBox.h / (maxLat - minLat));

            const getXY = (p: [number, number]) => {
                const x = mapBox.x + (p[1] - minLng) * scale + (mapBox.w - ((maxLng - minLng) * scale)) / 2;
                const y = mapBox.y + mapBox.h - ((p[0] - minLat) * scale) - (mapBox.h - ((maxLat - minLat) * scale)) / 2;
                return { x, y };
            };

            ctx.save();
            ctx.globalAlpha = 0.85;
            drawSprayPath(ctx, coords, getXY, lineColor);
            ctx.restore();
        }
    }

    // 2. Aesthetic Typography (Bottom)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    const customColor = lineColor;
    const sport = normalizeSport(stats.type);

    // Distance (Data - 85% Opacity)
    const distNum = stats.distanceVal || '0.00';
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.font = "900 140px 'BBH Bartle'";
    ctx.fillStyle = customColor;
    ctx.fillText(distNum, 540, 1460);
    ctx.restore();

    // Units (Solid - 100% Opacity)
    ctx.save();
    ctx.font = "800 32px 'Plus Jakarta Sans'";
    ctx.fillStyle = secondaryColor;
    ctx.globalAlpha = 1.0;
    if (typeof (ctx as any).letterSpacing !== 'undefined') (ctx as any).letterSpacing = "15px";
    ctx.fillText("KILOMETERS", 540, 1515);
    if (typeof (ctx as any).letterSpacing !== 'undefined') (ctx as any).letterSpacing = "0px";
    ctx.restore();

    // Secondary Data (Pace & Time - 85% Opacity)
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.font = "900 55px 'BBH Bartle'";
    ctx.fillStyle = customColor;
    ctx.fillText(stats.subValue || '0:00 /km', 310, 1700);
    ctx.fillText(stats.timeStr || '0h 00m', 770, 1700);
    ctx.restore();

    // Labels (Solid - 100% Opacity)
    ctx.save();
    ctx.font = "800 24px 'Plus Jakarta Sans'";
    ctx.fillStyle = secondaryColor;
    ctx.globalAlpha = 1.0;
    if (typeof (ctx as any).letterSpacing !== 'undefined') (ctx as any).letterSpacing = "10px";

    const paceLabel = sport === 'Ride' ? 'AVG. SPEED' : 'PACE';
    ctx.fillText(paceLabel, 310, 1740);
    ctx.fillText("TOTAL DURATION", 770, 1740);
    if (typeof (ctx as any).letterSpacing !== 'undefined') (ctx as any).letterSpacing = "0px";
    ctx.restore();
}
```

### C. Revert drawGraffitiBrand to Master (No Bounding Card Box)
Replace `drawGraffitiBrand` completely with the following:
```typescript
export function drawGraffitiBrand(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    const { accent: accentColor } = buildColors(textColor);

    const midX = 540;
    const colX1 = 270;
    const colX2 = 810;

    let heroY = 280;
    let row2Y = 580;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    const isWorkout = stats.type?.toLowerCase().includes('workout') || stats.type?.toLowerCase().includes('training') || stats.type?.toLowerCase().includes('gym') || !stats.hasDistance;

    // 1. Hero Metric (BOX 1 - Centered)
    const heroVal = (isWorkout ? (stats.timeStr || '0:00') : (stats.distanceVal || '0.00')).toUpperCase();
    ctx.save();
    ctx.globalAlpha = 1.0;
    ctx.font = "900 135px 'BBH Bartle'";
    ctx.fillStyle = accentColor;
    ctx.fillText(heroVal, midX, heroY);
    ctx.restore();

    // 2. Main Unit (BOX 1 - Sub label)
    const heroLabel = isWorkout ? "DURATION" : "KILOMETERS";
    ctx.save();
    ctx.font = "800 32px 'Michroma'";
    ctx.fillStyle = accentColor;
    ctx.globalAlpha = 1.0;
    if (typeof (ctx as any).letterSpacing !== 'undefined') (ctx as any).letterSpacing = "15px";
    ctx.fillText(heroLabel, midX, heroY + 65);
    ctx.restore();

    // 3. Activity Statistics
    const isRide = stats.type === 'Ride' || stats.type === 'EBikeRide';

    let m1Value = ''; let m1Label = '';
    let m2Value = ''; let m2Label = '';

    if (isWorkout) {
        m1Value = stats.avgHeartrate ? `${stats.avgHeartrate} BPM` : (stats.calories ? `${stats.calories} KCAL` : 'WORKOUT');
        m1Label = stats.avgHeartrate ? 'AVG HEART RATE' : (stats.calories ? 'CALORIES' : 'SESSION');
        m2Value = stats.calories && stats.avgHeartrate ? `${stats.calories} KCAL` : (stats.date || 'TODAY').toUpperCase();
        m2Label = stats.calories && stats.avgHeartrate ? 'CALORIES' : 'DATE';
    } else {
        m1Value = (stats.subValue || '0:00 /KM').toUpperCase();
        m1Label = isRide ? 'AVG. SPEED' : 'PACE';
        m2Value = (stats.timeStr || '0M').toUpperCase();
        m2Label = 'TOTAL DURATION';
    }

    const maxSubW = 500;

    const drawGridMetric = (val: string, label: string, x: number, y: number) => {
        ctx.save();
        ctx.fillStyle = accentColor;
        ctx.globalAlpha = 1.0;

        let subFontSize = 85;
        ctx.font = `900 ${subFontSize}px 'BBH Bartle'`;
        while (ctx.measureText(val).width > maxSubW && subFontSize > 40) {
            subFontSize -= 2;
            ctx.font = `900 ${subFontSize}px 'BBH Bartle'`;
        }
        ctx.fillText(val, x, y);
        ctx.restore();

        ctx.save();
        ctx.font = "800 24px 'Michroma'";
        ctx.fillStyle = accentColor;
        ctx.globalAlpha = 1.0;
        ctx.fillText(label, x, y + 55);
        ctx.restore();
    };

    drawGridMetric(m1Value, m1Label, colX1, row2Y);
    drawGridMetric(m2Value, m2Label, colX2, row2Y);
}
```

### D. drawJournalGrid (Box-Free Grid, EB Garamond & Outfit, Double-Pass glowing map)
Replace `drawJournalGrid` completely with the following:
```typescript
export function drawJournalGrid(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    const c = buildColors(textColor);
    const lineColor = textColor.startsWith('#') ? textColor : (textColor === 'black' ? '#000000' : '#ffffff');
    const isDark = isColorDark(lineColor);
    const sport = normalizeSport(stats.type);

    ctx.save();
    ctx.globalAlpha = 0.9;

    // Apply Bi-Directional Readability Shadow (Anti-Ghosting)
    ctx.save();
    ctx.shadowColor = isDark ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 4;

    // 1. DAY Indicator (Top Left) - sitting under default logo
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = lineColor;

    const dayLabel = (stats.dayName || "ACTIVITY").toUpperCase();
    ctx.font = "800 52px 'EB Garamond', serif";
    ctx.fillText(dayLabel, 60, 190);

    const monthDay = stats.rawDate ? new Date(stats.rawDate).getDate() : "1";
    ctx.font = "900 170px 'EB Garamond', serif";
    ctx.fillText(String(monthDay), 60, 240);

    // 2. Stats Grid (Top Right)
    const gridX = 540;
    const gridY = 80;
    const col2X = 810;
    const rowHeight = 90;

    ctx.textAlign = 'left';

    const drawGridItem = (x: number, y: number, label: string, value: string, unit: string) => {
        // Label
        ctx.font = "800 22px 'Outfit', sans-serif";
        ctx.globalAlpha = 0.6;
        ctx.fillText(label.toUpperCase(), x, y);

        // Value with Smart Scaling
        ctx.globalAlpha = 0.9;
        const baseSize = 42;
        ctx.font = `800 ${baseSize}px 'EB Garamond', serif`;

        let fontSize = baseSize;
        const maxW = 250;
        let valWidth = ctx.measureText(value).width;

        if (valWidth > maxW) {
            fontSize = Math.floor(baseSize * (maxW / valWidth));
            ctx.font = `800 ${fontSize}px 'EB Garamond', serif`;
            valWidth = ctx.measureText(value).width;
        }

        ctx.fillText(value, x, y + 30);

        // Unit
        if (unit) {
            ctx.font = "800 20px 'Outfit', sans-serif";
            ctx.fillText(unit, x + valWidth + 8, y + 45);
        }
    };

    const elevPoint = stats.dataPoints?.find(p => p.label.toLowerCase().includes('elevation')) || { value: '0', unit: 'm' };
    const hrPoint = stats.dataPoints?.find(p => p.label.toLowerCase().includes('avg')) ||
        { value: stats.avgHeartrate || (stats.dataPoints?.find(p => p.label.includes('HR'))?.value) || '-', unit: 'bpm' };

    const paceLabel = sport === 'Ride' ? 'AVG. SPEED' : 'PACE';
    const paceUnit = sport === 'Ride' ? 'km/h' : '/km';

    // Row 1: Distance | Pace
    drawGridItem(gridX, gridY, "DISTANCE", stats.distanceVal || "0.00", "km");
    drawGridItem(col2X, gridY, paceLabel, (stats.subValue || "").split(' ')[0] || "0:00", paceUnit);

    // Row 2: Moving Time | Elevation
    drawGridItem(gridX, gridY + rowHeight, "TIME", stats.timeStr || "0:00", "");
    drawGridItem(col2X, gridY + rowHeight, "ELEVATION", elevPoint.value, "m");

    // Row 3: Location | bpm
    const locationStr = stats.location?.length > 15 ? stats.location.slice(0, 15) + "…" : stats.location;
    drawGridItem(gridX, gridY + rowHeight * 2, "LOCATION", locationStr || "Scora", "");
    drawGridItem(col2X, gridY + rowHeight * 2, "HEART RATE", hrPoint.value, "bpm");

    // 3. Map (Top-Right Pocket - under stats)
    if (stats.polyline) {
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        const mapSize = 450;
        const mapX = 780;
        const mapY = 650;

        // Double pass route line for high aesthetic appeal
        drawRoutePath(ctx, stats.polyline, mapX, mapY, mapSize, {
            color: c.accent,
            strokeWidth: 10,
            opacity: 0.35
        });
        drawRoutePath(ctx, stats.polyline, mapX, mapY, mapSize, {
            color: lineColor,
            strokeWidth: 3
        });
    }

    ctx.restore();
}
```

### E. drawThinPath (Revert to Box-Free, EB Garamond & Outfit, 8px Map)
Replace `drawThinPath` completely with the following:
```typescript
export function drawThinPath(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    const colors = getThemeColors(textColor);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const { s1, s2, s3, hasMap } = getDynamicStats(stats);

    const cx = 540;
    const cy = 1000;
    const serifFont = "'EB Garamond', serif";
    const sansFont = "'Outfit', sans-serif";

    ctx.save();
    // 1. Header (Top, Small Sans, Wide)
    ctx.font = `800 24px ${sansFont}`;
    ctx.fillStyle = colors.label;
    ctx.globalAlpha = 0.6;
    setLetterSpacing(ctx, "0.5em");
    ctx.fillText((stats.title || "Activity").toUpperCase(), cx, cy - 400);
    setLetterSpacing(ctx, "0px");
    ctx.globalAlpha = 1.0;

    // 2. Map Backdrop (Massive) - Only if exists
    if (hasMap) {
        ctx.globalAlpha = 0.85; // Solid high visibility
        drawRoutePath(ctx, stats.polyline, cx, cy, 600, {
            color: colors.solid,
            strokeWidth: 8
        });
        ctx.globalAlpha = 1.0;
    }

    // 3. Hero Value - Dynamic scaling for large distances
    let vFontSize = 480;
    ctx.font = `500 ${vFontSize}px ${serifFont}`;
    const vWidth = ctx.measureText(s1.value).width;
    ctx.font = `700 80px ${serifFont}`;
    const uWidth = ctx.measureText(s1.label).width;
    const totalW = vWidth + 30 + uWidth;

    if (totalW > 960) {
        vFontSize = Math.floor(vFontSize * (960 / totalW));
    }

    drawStatWithUnit(ctx, cx, cy, s1.value, s1.label, {
        valueFont: `500 ${vFontSize}px ${serifFont}`,
        unitFont: `700 ${Math.max(40, Math.floor(vFontSize * 0.16))}px ${serifFont}`,
        valueColor: colors.solid,
        unitColor: colors.trans,
        gap: Math.max(10, Math.floor(vFontSize * 0.06)),
        align: 'center'
    });

    // 4. Footer Row - Upright text
    const footY = cy + 300;
    ctx.font = `500 60px ${serifFont}`;
    ctx.fillStyle = colors.solid;
    setLetterSpacing(ctx, "0.15em");
    const footerText = `${s2.value} ${s2.label} / ${s3.value} ${s3.label}`;
    ctx.fillText(footerText.toUpperCase(), cx, footY);
    setLetterSpacing(ctx, "0px");

    ctx.restore();
}
```

### F. drawNarrativeHighlight (Top Positioning Shift)
Change the `cy` position inside `drawNarrativeHighlight`:
```typescript
    const cx = 540;
    const cy = 340; // Moved closer to top under Scora logo
```

### G. drawCondesaStack (Box-Free Event Poster Layout, Michroma & Space Grotesk)
Replace `drawCondesaStack` completely with the following:
```typescript
export function drawCondesaStack(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    const cy = 960;
    const startX = 110;
    const rightCol = 580;

    const HEADER_SIZE = 90;
    const DATA_SIZE = 65;
    const UNIT_SIZE = 24;
    const UNIT_OFFSET = 100;
    const ROW_GAP = 220;

    const isDarkStr = textColor === 'white';
    const baseColor = isDarkStr ? '#FFFFFF' : '#000000';

    const rawDate = stats.rawDate ? new Date(stats.rawDate) : new Date();
    const weekday = new Intl.DateTimeFormat('es-ES', { weekday: 'long' }).format(rawDate).toUpperCase();
    const dayNum = rawDate.getDate().toString().padStart(2, '0');
    const startTimeResult = (stats.startTime || '10:24 PM').toUpperCase();
    const isWorkout = stats.type?.toLowerCase().includes('workout') || stats.type?.toLowerCase().includes('training') || stats.type?.toLowerCase().includes('gym') || !stats.hasDistance;
    const distValueResult = isWorkout ? (stats.timeStr || '0m') : (stats.distanceVal || '0.00');
    const distUnitResult = isWorkout ? 'DURATION' : (parseFloat(distValueResult) === 1 ? 'KILOMETER' : 'KILOMETERS');
    const paceValueResult = (stats.subValue || '').split(' ')[0] || '0:00';
    const paceUnitResult = (stats.subValue || '').split(' ')[1] || (stats.type === 'Ride' ? 'KM/H' : '/KM');
    const paceLabelResult = (stats.subLabel || (stats.type === 'Ride' ? 'Avg Speed' : 'Pace')).toUpperCase();
    const locationNameResult = (stats.location || 'MEXICO').toUpperCase();

    ctx.save();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = baseColor;

    applyAntiGhostingShadow(ctx, textColor);

    function renderSolidItem(text: string, x: number, y: number, size: number, weight = '900', spacing = '-0.05em') {
        ctx.font = `${weight} ${size}px 'Space Grotesk', sans-serif`;
        (ctx as any).letterSpacing = spacing;
        ctx.fillText(text, x, y);
    }

    function renderSolidUnit(text: string, x: number, y: number) {
        ctx.font = `800 ${UNIT_SIZE}px 'Michroma', sans-serif`;
        (ctx as any).letterSpacing = "0.15em";
        ctx.fillText(text, x, y);
    }

    let currY = cy - 500;

    // A. HEADER: DAY + NUMBER
    ctx.font = `800 ${HEADER_SIZE}px 'Michroma', sans-serif`;
    ctx.fillText(weekday, startX, currY);
    currY += 90;
    ctx.fillText(dayNum, startX, currY);
    currY += 240;

    // B. GRID ROW 1: TIME | DISTANCE
    renderSolidItem(startTimeResult, startX, currY, DATA_SIZE, '900', '-0.05em');
    renderSolidUnit("LOCAL TIME", startX, currY + UNIT_OFFSET);

    renderSolidItem(distValueResult, rightCol, currY, DATA_SIZE, '900', '-0.05em');
    renderSolidUnit(distUnitResult, rightCol, currY + UNIT_OFFSET);

    currY += ROW_GAP;

    // C. GRID ROW 2: PACE | LOCATION
    renderSolidItem(paceValueResult, startX, currY, DATA_SIZE, '900', '-0.05em');
    renderSolidUnit(`${paceLabelResult} (${paceUnitResult})`, startX, currY + UNIT_OFFSET);

    const locMaxW = 400;
    ctx.font = `900 ${DATA_SIZE}px 'Space Grotesk', sans-serif`;
    let locFontSize = DATA_SIZE;
    const locWidth = ctx.measureText(locationNameResult).width;
    if (locWidth > locMaxW) {
        locFontSize = Math.floor(DATA_SIZE * (locMaxW / locWidth));
    }
    renderSolidItem(locationNameResult, rightCol, currY, locFontSize, '900', '-0.05em');
    renderSolidUnit("LOCATION", rightCol, currY + UNIT_OFFSET);

    ctx.restore();
}
```

### H. drawStackedEditorial (Libertinus Math & Space Grotesk, Double-Pass glow map)
Replace `drawStackedEditorial` completely with the following:
```typescript
export function drawStackedEditorial(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    const colors = getThemeColors(textColor);
    const { s1, s2, hasMap } = getDynamicStats(stats);

    const cx = 540;
    const cy = 960;
    const valueFont = "'Libertinus Math', serif";
    const labelFont = "'Space Grotesk', sans-serif";

    ctx.save();
    applyAntiGhostingShadow(ctx, textColor);

    // 1. Title (Top, Clean Sans, Spaced)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `500 50px ${labelFont}`;
    ctx.fillStyle = colors.solid;
    setLetterSpacing(ctx, "0.1em");
    ctx.fillText((stats.title || "Activity").toUpperCase(), cx, 200);
    setLetterSpacing(ctx, "0px");

    // 2. Map (Large, Center) with double pass glow
    if (hasMap) {
        ctx.globalAlpha = 0.85;
        drawRoutePath(ctx, stats.polyline, cx, 850, 650, {
            color: colors.accent || '#80cbc4',
            strokeWidth: 8,
            opacity: 0.35
        });
        drawRoutePath(ctx, stats.polyline, cx, 850, 650, {
            color: colors.solid,
            strokeWidth: 2
        });
        ctx.globalAlpha = 1.0;
    }

    // 3. Stats (Small in bottom-right corner)
    const drawCompactStat = (data, x, y) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.textAlign = 'right';

        // Value
        ctx.font = `700 90px ${valueFont}`;
        ctx.fillStyle = colors.solid;
        ctx.fillText(data.value, 0, 0);

        // Label
        ctx.font = `700 32px ${labelFont}`;
        ctx.fillStyle = colors.label;
        ctx.globalAlpha = 0.9;
        setLetterSpacing(ctx, "0.3em");
        ctx.fillText(data.label.toUpperCase(), 0, 55);
        ctx.restore();
    };

    const cornerX = 980;
    const cornerY = 1750;

    const displayS2 = { ...s2 };
    if (displayS2.label === 'AVG SPEED') displayS2.label = 'KM/H';
    if (displayS2.label === 'AVG HEARTRATE') displayS2.label = 'BPM';

    drawCompactStat(displayS2, cornerX, cornerY);
    drawCompactStat(s1, cornerX - 320, cornerY);

    ctx.restore();
}
```

### I. drawEditorialRow (EB Garamond & Outfit, Dashed Dividers)
Replace `drawEditorialRow` completely with the following:
```typescript
export function drawEditorialRow(ctx: CanvasRenderingContext2D, stats: any, textColor = 'white') {
    const isDark = textColor === 'white';
    const cSolid = isDark ? '#ffffff' : '#000000';
    const borderFill = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)';

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const cx = 540;
    const cy = 960;

    const mainVal = (stats.mainValue || stats.distanceVal || (stats.timeStr ? stats.timeStr : '0.00')).toString().trim();
    const mainUnit = stats.mainValue ? stats.mainValue.replace(/[0-9.]/g, '').trim() || 'km' : (stats.timeStr && !stats.distanceVal ? 'time' : 'km');

    let subVal = '0:00';
    let subUnit = 'pace';
    if (stats.dataPoints) {
        const pacePt = stats.dataPoints.find((p: any) => p.label === 'Pace' || p.label === 'Avg Speed');
        if (pacePt) {
            subVal = pacePt.value;
            subUnit = pacePt.label === 'Avg Speed' ? 'km/h' : 'pace';
        } else {
            const timePt = stats.dataPoints.find((p: any) => p.label === 'Time' || p.label === 'Duration');
            if (timePt) {
                subVal = timePt.value;
                subUnit = (timePt.label || 'TIME').toLowerCase();
            }
        }
    }

    const hr = stats.avgHeartrate || stats.maxHeartrate || '-';

    const rowW = 800;
    const rowH = 140;

    // Dashed Borders
    ctx.save();
    applyAntiGhostingShadow(ctx, textColor);
    ctx.strokeStyle = borderFill;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);

    ctx.beginPath();
    ctx.moveTo(cx - rowW / 2, cy - rowH / 2);
    ctx.lineTo(cx + rowW / 2, cy - rowH / 2);
    ctx.moveTo(cx - rowW / 2, cy + rowH / 2 - 2);
    ctx.lineTo(cx + rowW / 2, cy + rowH / 2 - 2);
    ctx.stroke();
    ctx.restore();

    // Columns
    const colW = rowW / 3;

    ctx.save();
    applyAntiGhostingShadow(ctx, textColor);
    for (let i = 0; i < 3; i++) {
        const x = cx - rowW / 2 + (i * colW) + colW / 2;

        let v = '', u = '';
        if (i === 0) { v = mainVal; u = mainUnit; }
        if (i === 1) { v = subVal; u = subUnit; }
        if (i === 2) { v = hr.toString(); u = 'bpm'; }

        ctx.globalAlpha = 1.0;
        ctx.fillStyle = cSolid;
        ctx.font = "800 50px 'EB Garamond', serif";
        ctx.fillText(v, x, cy - 10);

        ctx.globalAlpha = 0.55;
        ctx.font = "800 16px 'Outfit', sans-serif";
        if ((ctx as any).letterSpacing !== undefined) { (ctx as any).letterSpacing = "0.2em"; }
        ctx.fillText(u.toUpperCase(), x, cy + 40);
        if ((ctx as any).letterSpacing !== undefined) { (ctx as any).letterSpacing = "0px"; }
    }
    ctx.restore();
}
```
