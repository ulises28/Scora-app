import { Redis } from '@upstash/redis';

const LOCK_KEY = 'strava:slot:lock';
const REDIS_CONFIGURED = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { code, sessionId } = req.body;

        // ✅ Queue gate: only the session holding the lock may exchange a token.
        if (REDIS_CONFIGURED && sessionId && sessionId !== 'fallback') {
            try {
                const redis = new Redis({
                    url: process.env.UPSTASH_REDIS_REST_URL,
                    token: process.env.UPSTASH_REDIS_REST_TOKEN
                });
                const lockHolder = await redis.get(LOCK_KEY);
                
                console.log(`[Queue Gate] Request session: ${sessionId} | Lock holder: ${lockHolder}`);

                if (lockHolder !== sessionId) {
                    return res.status(503).json({
                        error: 'SlotBusy',
                        message: `Another athlete is currently connecting (Holder: ${lockHolder}). Please wait in the queue.`,
                        lockHolder
                    });
                }
            } catch (kvError) {
                console.warn('[Queue] Redis check failed, allowing through:', kvError.message);
            }
        }

        const CLIENT_ID = process.env.Client_ID || process.env.VITE_STRAVA_CLIENT_ID || process.env.STRAVA_CLIENT_ID;
        const CLIENT_SECRET = process.env.Client_Secret || process.env.VITE_STRAVA_CLIENT_SECRET || process.env.STRAVA_CLIENT_SECRET;

        const stravaResponse = await fetch('https://www.strava.com/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                code: code,
                grant_type: 'authorization_code'
            })
        });

        const data = await stravaResponse.json();

        // Si Strava devuelve un error, lo enviamos al frontend
        if (!stravaResponse.ok) {
            // 🚨 SPECIAL CASE: If we hit the 1-athlete limit (403), immediately try to
            // deauth the orphaned token to clear the blockage on Strava's side.
            if (stravaResponse.status === 403 && REDIS_CONFIGURED) {
                try {
                    const redis = new Redis({
                        url: process.env.UPSTASH_REDIS_REST_URL,
                        token: process.env.UPSTASH_REDIS_REST_TOKEN
                    });
                    const orphanedToken = await redis.get('strava:active_token');
                    if (orphanedToken) {
                        console.log('[Queue] 403 Hit: Found orphaned token, attempting deauth on Strava...');
                        await fetch('https://www.strava.com/oauth/deauthorize', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ access_token: orphanedToken })
                        });
                        await redis.del('strava:active_token');
                        console.log('[Queue] 403 Recovery: Orphaned token deauthorized.');
                    }
                    // Always clear the lock so the next user can try immediately.
                    await redis.del(LOCK_KEY);
                    console.log('[Queue] 403 Recovery: Lock cleared.');
                } catch (e) {
                    console.error('[Queue] 403 recovery cleanup failed:', e);
                }
            }
            return res.status(stravaResponse.status).json(data);
        }

        // ✅ SUCCESS: Save the active token AND refresh the lock TTL so it outlives the data-fetching phase.
        if (REDIS_CONFIGURED && data.access_token) {
            try {
                const redis = new Redis({
                    url: process.env.UPSTASH_REDIS_REST_URL,
                    token: process.env.UPSTASH_REDIS_REST_TOKEN
                });
                // Save the active token without expiry so it can always be found by the Admin Reset
                await redis.set('strava:active_token', data.access_token);
                // 🔑 Refresh the lock TTL to 120s so it doesn't expire during the fetch phase.
                if (sessionId && sessionId !== 'fallback') {
                    await redis.set(LOCK_KEY, sessionId, { ex: 120 });
                    console.log('[Queue] Lock TTL refreshed to 120s after successful token exchange.');
                }
                console.log('[Queue] Saved active token to Redis without TTL to prevent deadlock');
            } catch (kvError) {
                console.warn('[Queue] Failed to save active token or refresh lock:', kvError.message);
            }
        }

        return res.status(200).json(data);

    } catch (error) {
        console.error("Error exchanging Strava token:", error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}

