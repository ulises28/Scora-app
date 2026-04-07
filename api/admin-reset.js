import { Redis } from '@upstash/redis';

const LOCK_KEY = 'strava:slot:lock';
const QUEUE_KEY = 'strava:slot:queue';
const ACTIVE_TOKEN_KEY = 'strava:active_token';

const REDIS_CONFIGURED = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // 🔒 GATEKEEPER: Ensure only the Boss (you) can trigger a total reset.
    const authHeader = req.headers.authorization;
    const expectedUser = process.env.ADMIN_USER || 'admin';
    const expectedPass = process.env.ADMIN_PASS;

    if (!expectedPass) {
        console.warn('[Admin] SECURITY ALERT: ADMIN_PASS not set in Vercel. Reset blocked.');
        return res.status(500).json({ error: 'System not configured for remote reset. Add ADMIN_PASS in Vercel.' });
    }

    // Simple comparison for 'Useful Admin' logic
    const providedSecret = authHeader ? authHeader.replace('Bearer ', '') : '';
    const masterSecret = Buffer.from(`${expectedUser}:${expectedPass}`).toString('base64');

    if (providedSecret !== masterSecret) {
        console.warn('[Admin] FAILED LOGIN ATTEMPT for reset.');
        return res.status(401).json({ error: 'Unauthorized: Incorrect Admin credentials.' });
    }

    if (!REDIS_CONFIGURED) {
        return res.status(200).json({ message: 'Redis is not configured. Reset not necessary.' });
    }

    try {
        const redis = new Redis({
            url: process.env.UPSTASH_REDIS_REST_URL,
            token: process.env.UPSTASH_REDIS_REST_TOKEN
        });

        const activeToken = await redis.get(ACTIVE_TOKEN_KEY);
        let tokenRevoked = false;

        // Intentar revocar si hay un active token atrapado en Redis
        if (activeToken) {
            console.log('[Admin] Found orphaned token in Redis. Attempting to deauthorize...');
            try {
                await fetch('https://www.strava.com/oauth/deauthorize', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ access_token: activeToken })
                });
                tokenRevoked = true;
                console.log('[Admin] Orphaned token successfully deauthorized on Strava.');
            } catch (cleanupErr) {
                console.error('[Admin] Failed to deauthorize orphaned token on Strava:', cleanupErr);
            }
        }

        // Limpiar todas las claves de control
        await redis.del(LOCK_KEY);
        await redis.del(QUEUE_KEY);
        await redis.del(ACTIVE_TOKEN_KEY);

        console.log('[Admin] Queue and locks forcibly cleared.');

        return res.status(200).json({ 
            message: 'System reset successful.',
            tokenRevoked: tokenRevoked,
            details: 'The queue, locks, and any stored active tokens were purged.'
        });

    } catch (error) {
        console.error('[Admin] Error resetting system:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
