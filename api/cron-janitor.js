import { Redis } from '@upstash/redis';

const LOCK_KEY = 'strava:slot:lock';
const ACTIVE_TOKEN_KEY = 'strava:active_token';

// Check if Redis is configured at module load time
const REDIS_CONFIGURED = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

export default async function handler(req, res) {
    // Vercel Cron sends a secret header we could check, or we just allow GET/POST
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const authHeader = req.headers.authorization;
    const urlSecret = req.query.cron_secret;
    
    const isHeaderValid = authHeader === `Bearer ${process.env.CRON_SECRET}`;
    const isUrlValid = urlSecret === process.env.CRON_SECRET;

    if (process.env.CRON_SECRET && !isHeaderValid && !isUrlValid) {
        return res.status(401).json({ error: 'Unauthorized. Only Vercel infrastructure or Admins may trigger the Janitor.' });
    }

    if (!REDIS_CONFIGURED) {
        return res.status(200).json({ status: 'skipped', reason: 'No Redis configured' });
    }

    const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN
    });

    try {
        console.log('[Cron Janitor] Running checks...');

        // Check if there is an active token
        const activeToken = await redis.get(ACTIVE_TOKEN_KEY);
        const lockHolder = await redis.get(LOCK_KEY);

        let actionsTaken = [];

        // 1. If we have a token but no lock holder, it's definitely orphaned.
        if (activeToken && !lockHolder) {
            console.log('[Cron Janitor] Orphaned token detected (no lock holder). Deauthorizing...');
            
            const stravaResponse = await fetch('https://www.strava.com/oauth/deauthorize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ access_token: activeToken })
            });

            if (stravaResponse.ok) {
                console.log('[Cron Janitor] Successfully deauthorized abandoned token.');
                actionsTaken.push('deauthorized_orphaned_token');
            } else {
                console.warn('[Cron Janitor] Failed to deauth token with Strava, status:', stravaResponse.status);
                actionsTaken.push('failed_deauth_orphaned_token');
            }

            // Always clear it from Redis now that we've tried
            await redis.del(ACTIVE_TOKEN_KEY);
        } else if (activeToken && lockHolder) {
            // NOTE: If the app adds long-polling or heartbeats, we might want to check the TTL of the lock here.
            // Currently lock has 30s TTL, but if it's renewed, it stays. We will skip active locks for now,
            // as if the user abandons it, the lock will expire to null, and the NEXT 5 min check will catch the token without a lock.
            console.log('[Cron Janitor] Active token and lock present. Proceeding normally.');
        } else if (!activeToken && lockHolder) {
            // A lock holder but no token generated yet? Might still be logging in. Do nothing.
            console.log('[Cron Janitor] Lock present but no token. Assuming auth in progress.');
        } else {
            console.log('[Cron Janitor] No orphaned tokens or locks to clean. All clear.');
        }

        return res.status(200).json({ status: 'success', summary: actionsTaken });

    } catch (error) {
        console.error('[Cron Janitor] Execution failed:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
