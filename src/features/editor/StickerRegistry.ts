import { StickerDefinition } from './types';
import * as Renderers from './CanvasPainter';

/**
 * SCORA: Master Sticker Registry (v3.0 Modular Foundation)
 * 
 * We use a Dual-List Architecture to keep the production UI clean while 
 * preserving legacy or experimental stickers in the codebase.
 */

// ─── 1. ACTIVE PRODUCTIVE STICKERS ───────────────────────────────────────────
// These are visible in the Studio UI Gallery.
export const ACTIVE_STICKER_LIST: StickerDefinition[] = [
    { id: 'social-chat', category: 'all', supportsBlackText: false, features: { distance: true, duration: true, paceSpeed: true, map: true }, render: Renderers.drawChatSticker },
    { id: 'note-minimal', category: 'all', supportsBlackText: true, preferredCase: 'title', features: { distance: true, duration: true, paceSpeed: true }, render: Renderers.drawNoteSticker },
    { id: 'ultra-detail', category: 'all', supportsCustomColor: true, supportsBlackText: true, features: { distance: true, duration: true, paceSpeed: true, alwaysShowDuration: true }, render: Renderers.drawUltraDetail },
    { id: 'graffiti-expo', category: 'all', supportsCustomColor: true, supportsBlackText: true, features: { map: true }, render: Renderers.drawGraffitiExpo },
    { id: 'graffiti-brand', category: 'all', supportsCustomColor: true, supportsBlackText: true, features: { distance: true, duration: true, paceSpeed: true, alwaysShowDuration: true }, expectedLabels: ['KILOMETERS', 'TOTAL DURATION', 'PACE', 'AVG. SPEED'], render: Renderers.drawGraffitiBrand },
    { id: 'editorial-strip', category: 'all', supportsBlackText: false, compact: true, features: { distance: true, duration: true, date: true }, render: Renderers.drawEditorialStrip },
    { id: 'science-pro', category: 'all', supportsBlackText: false, features: { distance: true, heartRate: true, date: true, paceSpeed: false }, render: Renderers.drawSciencePro },
    { id: 'narrative-highlight', category: 'all', supportsBlackText: true, preferredCase: 'lowercase', features: { distance: true, duration: true, paceSpeed: true, date: true, location: true }, render: Renderers.drawNarrativeHighlight },
    { id: 'location-pill', category: 'all', supportsBlackText: true, compact: true, preferredCase: 'title', features: { distance: true, location: true }, render: Renderers.drawLocationPill },
    { id: 'dm', category: 'distance', features: { distance: true, paceSpeed: true, startTime: true, location: true }, render: Renderers.drawDMModular },
    { id: 'journal-grid', category: 'distance', supportsCustomColor: true, supportsBlackText: true, features: { distance: true, duration: true, map: true, heartRate: true, location: true }, render: Renderers.drawJournalGrid },
    { id: 'finish-line', category: 'distance', supportsBlackText: false, features: { distance: true, duration: true, paceSpeed: true }, render: Renderers.drawFinishLine },
    { id: 'tiny-gps', category: 'all', supportsBlackText: true, compact: true, preferredCase: 'title', features: { distance: true, location: true }, render: Renderers.drawTinyGPS },
    { id: 'pulse-row', category: 'all', supportsBlackText: false, features: { heartRate: true, heartRateType: 'max' }, render: Renderers.drawPulseRow },
    { id: 'thin-path', category: 'distance', supportsBlackText: true, features: { distance: true, paceSpeed: true, map: true }, render: Renderers.drawThinPath },
    { id: 'brutalist-letters', category: 'all', supportsBlackText: true, compact: true, features: { distance: true, duration: true }, render: Renderers.drawBrutalistLetters },
    { id: 'boxed-metric', category: 'distance', supportsBlackText: true, compact: true, features: { distance: true }, render: Renderers.drawBoxedMetric },
    { id: 'condesa-stack', category: 'all', supportsBlackText: true, features: { distance: true, paceSpeed: true, startTime: true, date: true }, expectedMetadata: ['location', 'LOCAL TIME', 'LOCATION'], render: Renderers.drawCondesaStack },
    { id: 'mono-minimal', category: 'all', supportsBlackText: true, compact: true, features: { distance: true, duration: true }, render: Renderers.drawMonoMinimal },
    { id: 'split-badge', category: 'all', supportsBlackText: false, compact: true, features: { distance: true, paceSpeed: true }, render: Renderers.drawSplitBadge },
    { id: 'stacked-editorial', category: 'distance', supportsBlackText: true, features: { distance: true, paceSpeed: true, map: true }, render: Renderers.drawStackedEditorial },
    { id: 'micro-serif', category: 'distance', supportsBlackText: true, features: { distance: true, paceSpeed: true, map: true }, render: Renderers.drawMicroSerif },
    { id: 'vhs-retro', category: 'distance', supportsBlackText: false, features: { distance: true, date: true, startTime: true }, render: Renderers.drawVHSRetro },
    { id: 'statement', category: 'distance', supportsBlackText: true, compact: true, features: { distance: true, duration: true, date: true, title: true }, render: Renderers.drawStatement },
    { id: 'marginalia', category: 'all', supportsBlackText: true, compact: true, features: { distance: true, duration: true, title: true }, render: Renderers.drawMarginalia },
    { id: 'editorial-row', category: 'all', supportsBlackText: true, features: { distance: true, paceSpeed: true, heartRate: true }, render: Renderers.drawEditorialRow },
    { id: 'pro-vertical', category: 'all', supportsBlackText: true, features: { distance: true, paceSpeed: true, startTime: true }, render: Renderers.drawProVertical },
    { id: 'mono-split', category: 'distance', supportsBlackText: false, features: { distance: true, paceSpeed: true }, render: Renderers.drawMonoSplit },
    { id: 'essential-italic', category: 'distance', supportsBlackText: true, features: { distance: true, paceSpeed: true }, render: Renderers.drawEssentialItalic },
    { id: 'obsidian-bar', category: 'distance', supportsBlackText: false, features: { distance: true, paceSpeed: true }, render: Renderers.drawObsidianBar },
    { id: 'modern-pill', category: 'distance', supportsBlackText: false, preferredCase: 'title', features: { distance: true, paceSpeed: true }, render: Renderers.drawModernPill },
    { id: 'editorial-archive', category: 'distance', supportsBlackText: false, features: { distance: true, paceSpeed: true, duration: true, date: true }, render: Renderers.drawEditorialArchive },
    { id: 'info-glass', category: 'all', supportsBlackText: false, features: { distance: true, paceSpeed: true, duration: true }, render: Renderers.drawInfoGlass },
    { id: 'workout-receipt', category: 'distance', supportsBlackText: false, features: { distance: true, paceSpeed: true, duration: true, date: true }, render: Renderers.drawWorkoutReceipt },
    { id: 'brutalist-bold', category: 'distance', supportsBlackText: false, features: { distance: true, paceSpeed: true }, render: Renderers.drawBrutalistBold },
    { id: 'data-modular', category: 'distance', supportsBlackText: false, features: { distance: true, paceSpeed: true }, render: Renderers.drawDataModular },
    { id: 'glass-slice', category: 'distance', supportsBlackText: false, features: { distance: true, paceSpeed: true }, render: Renderers.drawGlassSlice },
    { id: 'stealth-bar', category: 'distance', supportsBlackText: false, features: { distance: true, paceSpeed: true }, render: Renderers.drawStealthBar },
    { id: 'vertical-label', category: 'distance', supportsBlackText: false, features: { distance: true, paceSpeed: true, duration: true }, render: Renderers.drawVerticalLabel },
    { id: 'minimal', category: 'all', supportsBlackText: true, compact: true, preferredCase: 'title', features: { distance: true, duration: true }, render: Renderers.drawMinimalModular },
    { id: 'classic-stack', category: 'all', supportsBlackText: true, features: { distance: true, duration: true, date: true }, render: Renderers.drawClassicStack },
];

// ─── 2. ARCHIVED / HIDDEN STICKERS ───────────────────────────────────────────
// These are preserved in the code but hidden from the main UI Gallery.
export const ARCHIVED_STICKER_LIST: StickerDefinition[] = [
    { id: 'step-master', category: 'all', supportsBlackText: true, compact: true, features: { distance: true, duration: true }, render: Renderers.drawStepMaster },
    { id: 'dual-pill', category: 'all', supportsBlackText: true, compact: true, features: { distance: true, duration: true }, render: Renderers.drawDualPill },
    { id: 'serif-float', category: 'distance', supportsBlackText: true, compact: true, features: { distance: true, duration: true }, render: Renderers.drawSerifFloat },
    { id: 'massive-serif', category: 'all', supportsBlackText: true, compact: true, features: { distance: true, duration: true }, render: Renderers.drawMassiveSerif },
    { id: 'mag-cover', category: 'all', supportsBlackText: true, features: { date: true, title: true }, render: Renderers.drawMagCover },
    { id: 'mono-ghost', category: 'all', supportsBlackText: true, features: { duration: true, date: true, title: true }, render: Renderers.drawMonoGhost },
    { id: 'coords-v2', category: 'distance', supportsBlackText: true, compact: true, features: { distance: true, duration: true }, render: Renderers.drawCoordsV2 },
    { id: 'typewriter-mono', category: 'all', supportsBlackText: true, compact: true, features: { distance: true, duration: true, date: true }, render: Renderers.drawTypewriterMono },
    { id: 'brutal-slash', category: 'all', supportsBlackText: true, features: { duration: true }, render: Renderers.drawBrutalSlash },
    { id: 'swiss-minimal', category: 'distance', supportsBlackText: true, compact: true, features: { distance: true, duration: true }, render: Renderers.drawSwissMinimal },
    { id: 'pure-map', category: 'distance', supportsCustomColor: true, supportsBlackText: true, features: { map: true }, render: Renderers.drawPureMap },
    { id: 'track-record', category: 'distance', supportsBlackText: true, features: { distance: true }, render: Renderers.drawTrackRecord },
    { id: 'metric-thin', category: 'distance', supportsBlackText: true, features: { distance: true, paceSpeed: true }, render: Renderers.drawMetricThin },
    { id: 'stats', category: 'distance', supportsBlackText: true, features: { distance: true, paceSpeed: true }, render: Renderers.drawStatsModular },
    { id: 'neon-slanted', category: 'all', supportsBlackText: true, features: { distance: true, duration: true }, render: Renderers.drawNeonSlanted },
    { id: 'aesthetic-medal', category: 'workout', supportsBlackText: true, features: { distance: false, paceSpeed: true, date: true }, render: Renderers.drawAestheticMedal },
    { id: 'scora-stealth', category: 'distance', features: { distance: true, paceSpeed: true, duration: true, heartRate: true, map: true }, seasonal: true, render: Renderers.drawScoraStealth },
    { id: 'neon-capsule', category: 'distance', features: { distance: true, paceSpeed: true }, seasonal: true, render: Renderers.drawNeonCapsule },
    { id: 'tech-hud', category: 'distance', features: { distance: true, paceSpeed: true, duration: true }, seasonal: true, render: Renderers.drawTechHUD },
    { id: 'award-badge', category: 'workout', features: { distance: true, duration: true }, seasonal: true, render: Renderers.drawAwardBadge },
    { id: 'data-matrix', category: 'distance', features: { distance: true, paceSpeed: true, duration: true }, seasonal: true, render: Renderers.drawDataMatrix },
    { id: 'frosted-minimal', category: 'workout', features: { duration: true }, seasonal: true, render: Renderers.drawFrostedMinimal },
    { id: 'performance-bars', category: 'distance', supportsBlackText: true, features: { distance: true, paceSpeed: true, duration: true }, seasonal: true, render: Renderers.drawPerformanceBars },
    { id: '8m2', category: 'distance', features: { distance: true, paceSpeed: true, duration: true, map: true }, seasonal: true, render: Renderers.draw8M2Modular },
    { id: '8m', category: 'distance', features: { distance: true, paceSpeed: true, duration: true, map: true }, seasonal: true, render: Renderers.draw8MModular },
    { id: 'route', category: 'all', features: { map: true }, render: Renderers.drawRouteModular },
];

/**
 * The unified UI-facing list. 
 * External modules like TemplateManager will only see these active stickers.
 */
export const STICKER_LIST: StickerDefinition[] = ACTIVE_STICKER_LIST;

/**
 * The full mapping of IDs to Definitions. 
 * We combine both lists here so that even archived stickers can be rendered 
 * if their ID is explicitly called.
 */
export const STICKER_REGISTRY: Record<string, StickerDefinition> = [
    ...ACTIVE_STICKER_LIST,
    ...ARCHIVED_STICKER_LIST
].reduce((acc, current) => {
    acc[current.id] = current;
    return acc;
}, {} as Record<string, StickerDefinition>);
