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
    { id: 'note-accent', supportsCustomColor: true, category: 'all', supportsBlackText: true, preferredCase: 'title', features: { distance: true, duration: true, paceSpeed: true }, render: Renderers.drawNoteAccentSticker },
    { id: 'dot-grid-architect', supportsCustomColor: true, category: 'all', supportsBlackText: true, features: { distance: true, duration: true, paceSpeed: true, map: true }, render: Renderers.drawDotGridArchitect },
    { id: 'chrome-v1', category: 'distance', features: { map: true }, render: Renderers.drawChromeHighContrastSticker },
    { id: 'neon_glow', supportsCustomColor: true, category: 'all', supportsBlackText: true, features: { distance: true, duration: true, paceSpeed: true, date: true, location: true }, render: Renderers.drawNeonGlow },
    { id: 'narrative-highlight', category: 'all', supportsBlackText: true, preferredCase: 'lowercase', features: { distance: true, duration: true, paceSpeed: true, date: true, location: true }, render: Renderers.drawNarrativeHighlight },
    { id: 'dm', category: 'distance', features: { distance: true, paceSpeed: true, startTime: true, location: true }, render: Renderers.drawDMModular },
    { id: 'wave_title', supportsCustomColor: true, category: 'all', supportsBlackText: true, features: { distance: true, duration: true, paceSpeed: true, date: true }, render: Renderers.drawWaveTitle },
    { id: 'social-chat', category: 'all', supportsBlackText: false, features: { distance: true, duration: true, paceSpeed: true, map: true }, render: Renderers.drawChatSticker },
    { id: 'graffiti-map', supportsCustomColor: true, category: 'all', supportsBlackText: true, features: { distance: true, duration: true, map: true }, render: Renderers.drawGraffitiMap },
    { id: 'note-minimal', category: 'all', supportsBlackText: true, preferredCase: 'title', features: { distance: true, duration: true, paceSpeed: true }, render: Renderers.drawNoteSticker },
    { id: 'retro_distance', supportsCustomColor: true, category: 'all', supportsBlackText: true, features: { distance: true, duration: true, paceSpeed: true }, render: Renderers.drawRetroDistance },
    { id: 'wavy_quote', supportsCustomColor: true, category: 'all', supportsBlackText: true, features: { distance: false, map: true }, render: Renderers.drawWavyQuote },
    { id: 'stacked-editorial', supportsCustomColor: true, category: 'distance', supportsBlackText: true, features: { distance: true, paceSpeed: true, map: true }, render: Renderers.drawStackedEditorial },
    { id: 'tiny-gps', supportsCustomColor: true, category: 'all', supportsBlackText: true, compact: true, preferredCase: 'title', features: { distance: true, duration: true, location: true }, render: Renderers.drawTinyGPS },
    { id: 'split-badge', category: 'all', supportsBlackText: false, compact: true, features: { distance: true, paceSpeed: true, duration: true }, render: Renderers.drawSplitBadge },
    { id: 'location-pill', category: 'all', supportsBlackText: true, compact: true, preferredCase: 'title', features: { distance: true, location: true }, render: Renderers.drawLocationPill },
    { id: 'thin-path', supportsCustomColor: true, category: 'distance', supportsBlackText: true, features: { distance: true, paceSpeed: true, map: true, location: true }, render: Renderers.drawThinPath },
    { id: 'tempo_graph', category: 'all', supportsBlackText: true, features: { distance: true, duration: true, paceSpeed: true, map: true }, render: Renderers.drawTempoGraph },
    { id: 'studio-precision', supportsCustomColor: true, category: 'distance', supportsBlackText: true, features: { distance: true, paceSpeed: true, duration: true, elevation: true }, seasonal: false, render: Renderers.drawStudioPrecision },
    { id: 'pulse-row', supportsCustomColor: true, category: 'all', supportsBlackText: false, features: { heartRate: true, heartRateType: 'max' }, render: Renderers.drawPulseRow },
    { id: 'graffiti-expo', supportsCustomColor: true, category: 'all', supportsBlackText: true, features: { map: true }, render: Renderers.drawGraffitiExpo },
    { id: 'graffiti-brand', supportsCustomColor: true, category: 'all', supportsBlackText: true, features: { distance: true, duration: true, paceSpeed: true, alwaysShowDuration: true }, expectedLabels: ['KILOMETERS', 'TOTAL DURATION', 'PACE', 'AVG. SPEED'], render: Renderers.drawGraffitiBrand },
    { id: 'finish-line', supportsCustomColor: true, category: 'distance', supportsBlackText: false, features: { distance: true, duration: true, paceSpeed: true }, render: Renderers.drawFinishLine },
    { id: 'vhs-retro', category: 'distance', supportsBlackText: false, features: { distance: true, date: true, startTime: true }, render: Renderers.drawVHSRetro },
    { id: 'micro-serif', supportsCustomColor: true, category: 'distance', supportsBlackText: true, features: { distance: true, paceSpeed: true, map: true }, render: Renderers.drawMicroSerif },
    { id: 'classic-stack', category: 'all', supportsBlackText: true, compact: true, features: { distance: true, duration: true, date: true }, render: Renderers.drawClassicStack },
    { id: 'bold-day', supportsCustomColor: true, category: 'distance', supportsBlackText: true, preferredCase: 'uppercase', features: { distance: true, date: true }, seasonal: false, render: Renderers.drawBoldDay },
    { id: 'workout-receipt', category: 'distance', supportsBlackText: false, features: { distance: true, paceSpeed: true, duration: true, date: true }, render: Renderers.drawWorkoutReceipt },
    { id: 'condesa-stack', supportsCustomColor: true, category: 'all', supportsBlackText: true, features: { distance: true, paceSpeed: true, startTime: true, date: true }, expectedMetadata: ['location', 'LOCAL TIME', 'LOCATION'], render: Renderers.drawCondesaStack },
    { id: 'journal-grid', supportsCustomColor: true, category: 'distance', supportsBlackText: true, features: { distance: true, duration: true, map: true, heartRate: true, location: true }, render: Renderers.drawJournalGrid },
    { id: 'science-pro', category: 'all', supportsBlackText: false, features: { distance: true, heartRate: true, date: true, paceSpeed: false }, render: Renderers.drawSciencePro },
    { id: 'editorial-strip', supportsCustomColor: true, category: 'all', supportsBlackText: false, compact: true, features: { distance: true, duration: true, date: true }, render: Renderers.drawEditorialStrip },
];

// ─── 2. ARCHIVED / HIDDEN STICKERS ───────────────────────────────────────────
// These are preserved in the code but hidden from the main UI Gallery.
export const ARCHIVED_STICKER_LIST: StickerDefinition[] = [
    { id: 'coffee_club', supportsCustomColor: true, category: 'all', supportsBlackText: true, features: { distance: true, duration: true, paceSpeed: true, date: true, location: true, map: true }, render: Renderers.drawCoffeeClub },
    { id: 'boxed-metric', supportsCustomColor: true, category: 'distance', supportsBlackText: true, compact: true, features: { distance: true, duration: true }, render: Renderers.drawBoxedMetric },
    { id: 'editorial-row', category: 'all', supportsBlackText: true, features: { distance: true, paceSpeed: true, heartRate: true }, render: Renderers.drawEditorialRow },
    { id: 'stealth-bar', supportsCustomColor: true, category: 'distance', supportsBlackText: false, features: { distance: true, paceSpeed: true, duration: true }, render: Renderers.drawStealthBar },
    { id: 'vertical-label', supportsCustomColor: true, category: 'distance', supportsBlackText: false, features: { distance: true, paceSpeed: true, duration: true }, render: Renderers.drawVerticalLabel },
    { id: 'manifest-list', supportsCustomColor: true, category: 'all', supportsBlackText: true, features: { distance: true, duration: true, paceSpeed: true, elevation: true, calories: true, temperature: true }, seasonal: false, render: Renderers.drawManifestList },
    { id: 'brutalist-letters', category: 'all', supportsBlackText: true, compact: true, features: { distance: true, duration: true }, render: Renderers.drawBrutalistLetters },
    { id: 'pro-vertical', category: 'all', supportsBlackText: true, features: { distance: true, paceSpeed: true, startTime: true }, render: Renderers.drawProVertical },
    { id: 'mono-split', category: 'distance', supportsBlackText: false, features: { distance: true, paceSpeed: true }, render: Renderers.drawMonoSplit },
    { id: 'obsidian-bar', category: 'distance', supportsBlackText: false, features: { distance: true, paceSpeed: true, duration: true }, render: Renderers.drawObsidianBar },
    { id: 'modern-pill', category: 'distance', supportsBlackText: false, preferredCase: 'title', features: { distance: true, paceSpeed: true }, render: Renderers.drawModernPill },
    { id: 'info-glass', category: 'all', supportsBlackText: false, features: { distance: true, paceSpeed: true, duration: true }, render: Renderers.drawInfoGlass },
    { id: 'data-modular', category: 'distance', supportsBlackText: false, compact: true, features: { distance: true, paceSpeed: true, duration: true }, render: Renderers.drawDataModular },
    { id: 'ultra-detail', category: 'all', supportsBlackText: true, features: { distance: true, duration: true, paceSpeed: true, alwaysShowDuration: true }, render: Renderers.drawUltraDetail },
    { id: 'mono-minimal', category: 'all', supportsBlackText: true, compact: true, features: { distance: true, duration: true }, render: Renderers.drawMonoMinimal },
    { id: 'brutalist-bold', category: 'all', supportsBlackText: false, compact: true, features: { distance: true, paceSpeed: true, duration: true, heartRate: true }, render: Renderers.drawBrutalistBold },
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
    { id: 'pure-map', category: 'distance', supportsBlackText: true, features: { map: true }, render: Renderers.drawPureMap },
    { id: 'track-record', category: 'distance', supportsBlackText: true, features: { distance: true }, render: Renderers.drawTrackRecord },
    { id: 'metric-thin', category: 'distance', supportsBlackText: true, features: { distance: true, paceSpeed: true }, render: Renderers.drawMetricThin },
    { id: 'stats', category: 'distance', supportsBlackText: true, features: { distance: true, paceSpeed: true }, render: Renderers.drawStatsModular },
    { id: 'neon-slanted', category: 'all', supportsBlackText: true, compact: true, features: { distance: true, duration: true }, render: Renderers.drawNeonSlanted },
    { id: 'aesthetic-medal', category: 'workout', supportsBlackText: true, features: { distance: false, paceSpeed: true, date: true }, render: Renderers.drawAestheticMedal },
    { id: 'scora-stealth', category: 'distance', features: { distance: true, paceSpeed: true, duration: true, heartRate: true, map: true }, seasonal: true, render: Renderers.drawScoraStealth },
    { id: 'neon-capsule', category: 'distance', compact: true, features: { distance: true, paceSpeed: true }, seasonal: true, render: Renderers.drawNeonCapsule },
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
