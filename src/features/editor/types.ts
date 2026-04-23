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
    /** Obsidian Mode: Force duration rendering even in distance activities */
    alwaysShowDuration?: boolean;
}

export type StickerCategory = 'distance' | 'workout' | 'all' | 'map';

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
    /** Skip from gallery display */
    hidden?: boolean;
    render: (ctx: CanvasRenderingContext2D, stats: any, textColor: string) => void;
}
