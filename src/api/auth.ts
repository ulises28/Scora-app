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
 * Opens the Strava OAuth popup.
 * @param sessionId - queue session ID to thread through to token exchange
 */
export function openStravaAuth(sessionId: string = 'fallback') {
    const width = 600;
    const height = 700;
    const left = window.innerWidth / 2 - width / 2;
    const top = window.innerHeight / 2 - height / 2;

    // Pass sessionId via postMessage after auth completes (stored in module scope)
    (window as any).__queueSessionId = sessionId;

    const popup = window.open(
        getStravaLoginUrl(),
        'StravaAuth',
        `width=${width},height=${height},top=${top},left=${left},toolbar=no,menubar=no,scrollbars=yes`
    );

    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        window.location.replace(getStravaLoginUrl());
    }
}
