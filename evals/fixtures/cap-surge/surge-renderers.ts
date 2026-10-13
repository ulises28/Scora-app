/**
 * Cap-surge fixture renderers — stress eval only (evals/fixtures/cap-surge/).
 * Minimal paint so catalog is never empty; not product polish.
 * Appended to CanvasPainter.ts by apply-surge.ts, removed by revert-surge.ts.
 */
// ── SURGE-FIXTURE BEGIN ──
function drawSurgeStub(ctx: CanvasRenderingContext2D, stats: any, textColor: string, label: string) {
    const hasDistance = Boolean(stats.hasDistance || (stats.distanceVal && parseFloat(stats.distanceVal) > 0));
    const ink = textColor || '#ffffff';
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = ink;
    ctx.font = "700 64px 'Outfit', sans-serif";
    ctx.fillText(label, 540, 700);
    ctx.font = "800 120px 'Archivo Black', sans-serif";
    const hero = hasDistance ? (stats.distanceVal || '0.00') : (stats.timeStr || '0m');
    ctx.fillText(String(hero), 540, 920);
    if (hasDistance) {
        ctx.font = "500 48px 'Outfit', sans-serif";
        ctx.fillText((stats.subValue || stats.subLabel || '').toString(), 540, 1040);
    } else {
        ctx.font = "500 48px 'Outfit', sans-serif";
        ctx.fillText(stats.avgHeartrate ? `${stats.avgHeartrate} BPM` : 'WORKOUT', 540, 1040);
    }
    ctx.restore();
}

export function drawSurgeSummitRidge(ctx: CanvasRenderingContext2D, stats: any, textColor: string) { drawSurgeStub(ctx, stats, textColor, 'SUMMIT'); }
export function drawSurgeLakeSplit(ctx: CanvasRenderingContext2D, stats: any, textColor: string) { drawSurgeStub(ctx, stats, textColor, 'LAKE'); }
export function drawSurgeDesertBar(ctx: CanvasRenderingContext2D, stats: any, textColor: string) { drawSurgeStub(ctx, stats, textColor, 'DESERT'); }
export function drawSurgeCityPulse(ctx: CanvasRenderingContext2D, stats: any, textColor: string) { drawSurgeStub(ctx, stats, textColor, 'CITY'); }
export function drawSurgeNightGrid(ctx: CanvasRenderingContext2D, stats: any, textColor: string) { drawSurgeStub(ctx, stats, textColor, 'NIGHT'); }
export function drawSurgeAlpineCard(ctx: CanvasRenderingContext2D, stats: any, textColor: string) { drawSurgeStub(ctx, stats, textColor, 'ALPINE'); }
export function drawSurgeCoastLine(ctx: CanvasRenderingContext2D, stats: any, textColor: string) { drawSurgeStub(ctx, stats, textColor, 'COAST'); }
export function drawSurgeTrailBadge(ctx: CanvasRenderingContext2D, stats: any, textColor: string) { drawSurgeStub(ctx, stats, textColor, 'TRAIL'); }
export function drawSurgeSplitFinish(ctx: CanvasRenderingContext2D, stats: any, textColor: string) { drawSurgeStub(ctx, stats, textColor, 'FINISH'); }
export function drawSurgeZoneRing(ctx: CanvasRenderingContext2D, stats: any, textColor: string) { drawSurgeStub(ctx, stats, textColor, 'ZONE'); }
export function drawSurgeMonoStack(ctx: CanvasRenderingContext2D, stats: any, textColor: string) { drawSurgeStub(ctx, stats, textColor, 'MONO'); }
export function drawSurgePaceRibbon(ctx: CanvasRenderingContext2D, stats: any, textColor: string) { drawSurgeStub(ctx, stats, textColor, 'PACE'); }
// ── SURGE-FIXTURE END ──
