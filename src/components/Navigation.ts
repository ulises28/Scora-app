/**
 * Screen router with directional micro-transitions.
 * Screens: screen-feed | screen-stickers | screen-editor | screen-queue | auth-section
 * Feed → stickers → editor plays forward; going back plays reverse.
 */
const SCREEN_IDS = [
    'screen-feed',
    'screen-stickers',
    'screen-editor',
    'screen-queue',
    'auth-section',
] as const;
type ScreenId = (typeof SCREEN_IDS)[number];

let currentScreen: ScreenId | null = null;

export function showScreen(screenId: string) {
    const deeper =
        screenId === 'screen-editor'
            ? 2
            : screenId === 'screen-stickers'
                ? 1
                : 0;
    const currentDepth =
        currentScreen === 'screen-editor'
            ? 2
            : currentScreen === 'screen-stickers'
                ? 1
                : 0;

    const direction: 'forward' | 'back' = deeper >= currentDepth ? 'forward' : 'back';

    SCREEN_IDS.forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.remove('active', 'enter-forward', 'enter-back');
            el.classList.add('hidden');
        }
    });

    const target = document.getElementById(screenId);
    if (target) {
        target.classList.remove('hidden');
        target.classList.add('active', direction === 'back' ? 'enter-back' : 'enter-forward');
        void target.offsetWidth;
        target.classList.add('screen-anim');
    }

    currentScreen = (SCREEN_IDS as readonly string[]).includes(screenId)
        ? (screenId as ScreenId)
        : null;

    // Back affordance (LEFT side): stickers + editor
    const backBtn = document.getElementById('btn-back');
    const navContext = document.getElementById('editor-nav-context');
    const showChrome = screenId === 'screen-editor' || screenId === 'screen-stickers';

    if (backBtn) {
        if (showChrome) backBtn.classList.remove('hidden');
        else backBtn.classList.add('hidden');
    }
    if (navContext) {
        if (showChrome) navContext.classList.remove('hidden');
        else navContext.classList.add('hidden');
    }
}

export function getCurrentScreen(): ScreenId | null {
    return currentScreen;
}
