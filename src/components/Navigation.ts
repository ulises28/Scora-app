export function showScreen(screenId: string) {
    const screenFeed = document.getElementById('screen-feed');
    const screenEditor = document.getElementById('screen-editor');

    if (screenFeed) screenFeed.classList.remove('active');
    if (screenEditor) screenEditor.classList.remove('active');

    const target = document.getElementById(screenId);
    if (target) target.classList.add('active');
}
