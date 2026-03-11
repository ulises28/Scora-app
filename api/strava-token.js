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
                if (lockHolder !== sessionId) {
                    return res.status(503).json({
                        error: 'SlotBusy',
                        message: 'Another athlete is currently connecting. Please wait in the queue.'
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
            return res.status(stravaResponse.status).json(data);
        }

        // Éxito: Le devolvemos el payload al frontend (que contiene el access_token)
        
        // Save the active token for dead man's switch
        if (REDIS_CONFIGURED) {
            try {
                const redis = new Redis({
                    url: process.env.UPSTASH_REDIS_REST_URL,
                    token: process.env.UPSTASH_REDIS_REST_TOKEN
                });
                await redis.set('strava:active_token', data.access_token);
                console.log('[Queue] Saved active token to Redis for dead-man switch');
            } catch (kvError) {
                console.warn('[Queue] Failed to save active token:', kvError.message);
            }
        }

        return res.status(200).json(data);

    } catch (error) {
        console.error("Error exchanging Strava token:", error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
