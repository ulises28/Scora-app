export function showScreen(screenId: string) {
    const screens = ['screen-feed', 'screen-editor', 'screen-queue', 'auth-section'];
    
    screens.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.remove('active');
            el.classList.add('hidden');
        }
    });

    const target = document.getElementById(screenId);
    if (target) {
        target.classList.remove('hidden');
        target.classList.add('active');
    }

    // Toggle Header Context
    const navContext = document.getElementById('editor-nav-context');
    if (navContext) {
        if (screenId === 'screen-editor') navContext.classList.remove('hidden');
        else navContext.classList.add('hidden');
    }
}

