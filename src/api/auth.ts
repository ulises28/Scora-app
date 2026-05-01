import { getStravaLoginUrl } from './strava';

export function saveStravaAuth(tokenData: any) {
    if (tokenData && tokenData.access_token) {
        localStorage.setItem('stravaAuth', JSON.stringify({
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expires_at: tokenData.expires_at
        }));
    }
}

/**
 * Creates a blank popup synchronously to bypass Safari's popup blocker.
 * ONLY call this directly inside a click handler (synchronous user gesture).
 * Returns the window reference to be updated later with the real URL.
 */
export function createAuthPopup() {
    const width = 600;
    const height = 700;
    const left = window.innerWidth / 2 - width / 2;
    const top = window.innerHeight / 2 - height / 2;

    const popup = window.open(
        'about:blank',
        'StravaAuth',
        `width=${width},height=${height},top=${top},left=${left},toolbar=no,menubar=no,scrollbars=yes`
    );

    if (popup) {
        popup.document.write(`
            <style>
                body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f4f4f4; color: #666; }
                .loader { border: 3px solid #f3f3f3; border-top: 3px solid #fc4c02; border-radius: 50%; width: 24px; height: 24px; animation: spin 1s linear infinite; margin-right: 12px; }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            </style>
            <div class="loader"></div>
            <div>Conectando con Strava...</div>
        `);
    }
    return popup;
}

/**
 * Opens (or updates) the Strava OAuth popup.
 * ONLY use this when called from a direct user gesture (click handler).
 * @param sessionId - queue session ID to thread through to token exchange
 * @param existingPopup - optional window reference created synchronously
 */
export function openStravaAuth(sessionId: string = 'fallback', existingPopup: Window | null = null) {
    // 🛡️ CRITICAL: Persist sessionId for the message listener (Fixes exchangeToken bug)
    sessionStorage.setItem('scora_queue_session_id', sessionId);

    if (existingPopup && !existingPopup.closed) {
        existingPopup.location.href = getStravaLoginUrl(sessionId);
        return existingPopup;
    }

    const width = 600;
    const height = 700;
    const left = window.innerWidth / 2 - width / 2;
    const top = window.innerHeight / 2 - height / 2;

    const popup = window.open(
        getStravaLoginUrl(sessionId),
        'StravaAuth',
        `width=${width},height=${height},top=${top},left=${left},toolbar=no,menubar=no,scrollbars=yes`
    );

    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        window.location.replace(getStravaLoginUrl(sessionId));
    }
    
    return popup;
}

/**
 * 🛡️ SAFARI FIX: Full-page redirect to Strava OAuth.
 * Use this when calling from a polling interval or any async/non-user-gesture context.
 * Safari BLOCKS window.open in these contexts, but a full-page redirect always works.
 * @param sessionId - queue session ID
 */
export function redirectToStravaAuth(sessionId: string = 'fallback') {
    sessionStorage.setItem('scora_queue_session_id', sessionId);
    // Mark that this is a redirect flow (not a popup) so initApp knows to handle it.
    sessionStorage.setItem('scora_auth_mode', 'redirect');
    window.location.href = getStravaLoginUrl(sessionId);
}
