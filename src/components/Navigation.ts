export function showScreen(screenId: string) {
    const screenFeed = document.getElementById('screen-feed');
    const screenEditor = document.getElementById('screen-editor');

    if (screenFeed) screenFeed.classList.remove('active');
    if (screenEditor) screenEditor.classList.remove('active');

    const target = document.getElementById(screenId);
    if (target) target.classList.add('active');

    // Toggle Header Context
    const navContext = document.getElementById('editor-nav-context');
    if (navContext) {
        if (screenId === 'screen-editor') navContext.classList.remove('hidden');
        else navContext.classList.add('hidden');
    }
}

