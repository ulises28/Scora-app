/**
 * Sticker Registry Types
 */

export interface TemplateFeatures {
    distance?: boolean;
    paceSpeed?: boolean;
    duration?: boolean;
    heartRate?: boolean;
    heartRateType?: 'avg' | 'max';
    date?: boolean;
    startTime?: boolean;
    map?: boolean;
    /** Sticker renders the activity title / name */
    title?: boolean;
    /** Sticker renders geographic location */
    location?: boolean;
    /** Obsidian Mode: Force duration rendering even in distance activities */
    alwaysShowDuration?: boolean;
    elevation?: boolean;
    calories?: boolean;
    temperature?: boolean;
}

export type StickerCategory = 'distance' | 'workout' | 'all' | 'map';

/**
 * How a metric value is put on the canvas (drives test assertions).
 * - numeric: `fillText` of the formatted number (e.g. "5.00")
 * - spelled: `fillText` of number words (e.g. "five")
 * - segments: 7-segment / bar digits (not `fillText`) — unit label may still be text
 * - glyphs: glass/liquid glyph pipeline (offscreen `fillText`) — unit/date may still be text
 */
export type PaintForm = 'numeric' | 'spelled' | 'segments' | 'glyphs';

export interface StickerDefinition {
    id: string;
    features: TemplateFeatures;
    category: StickerCategory;
    supportsBlackText?: boolean;
    supportsCustomColor?: boolean;
    compact?: boolean;
    seasonal?: boolean;
    note?: string;
    preferredCase?: 'uppercase' | 'lowercase' | 'title';
    expectedMetadata?: string[];
    expectedLabels?: string[];
    /** Per-metric paint form; default is `numeric`. Part of the display contract. */
    paintForm?: Partial<Record<'distance' | 'time' | 'heartRate' | 'pace', PaintForm>>;
    /** Skip from gallery display */
    hidden?: boolean;
    render: (ctx: CanvasRenderingContext2D, stats: any, textColor: string, showLogo?: boolean) => void;
}
