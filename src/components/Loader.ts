export function removeLoader() {
    const loaderOverlay = document.getElementById('loader-overlay');
    if (loaderOverlay) {
        loaderOverlay.classList.add('hidden');
        setTimeout(() => loaderOverlay.remove(), 800);
    }
}
