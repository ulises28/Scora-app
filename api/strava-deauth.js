import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

const LOCK_KEY = 'strava:slot:lock';
const QUEUE_KEY = 'strava:slot:queue';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { access_token } = req.body;

        if (!access_token) {
            return res.status(400).json({ error: 'Access token is required' });
        }

        const stravaResponse = await fetch('https://www.strava.com/oauth/deauthorize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                access_token: access_token
            })
        });

        const data = await stravaResponse.json();

        if (!stravaResponse.ok) {
            return res.status(stravaResponse.status).json(data);
        }

        // ✅ Token revoked — release the queue lock so the next user can proceed.
        try {
            const nextInQueue = await redis.lindex(QUEUE_KEY, 0);
            if (nextInQueue) {
                // Promote the next session in line to be the lock holder
                await redis.lpop(QUEUE_KEY);
                await redis.set(LOCK_KEY, nextInQueue, { ex: 45 });
                console.log(`[Queue] Lock transferred to next session: ${nextInQueue}`);
            } else {
                // No one is waiting — delete the lock entirely
                await redis.del(LOCK_KEY);
                console.log('[Queue] Lock released. Queue is empty.');
            }
        } catch (kvError) {
            // Redis failure is non-critical — the token is already revoked
            console.error('[Queue] Failed to release Redis lock (non-fatal):', kvError);
        }

        return res.status(200).json(data);

    } catch (error) {
        console.error('Error revoking Strava token:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
