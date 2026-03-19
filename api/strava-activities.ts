import { Redis } from '@upstash/redis';

// 1. Instance outside handler to reuse connection (Warm Starts)
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const LOCK_KEY = 'strava:slot:lock';
const QUEUE_KEY = 'strava:slot:queue';
const ACTIVE_TOKEN_KEY = 'strava:active_token';

interface StravaRequestBody {
    access_token: string;
    sessionId: string;
}

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { access_token, sessionId }: StravaRequestBody = req.body;

    if (!access_token) {
        return res.status(400).json({ error: 'Access token is required' });
    }

    try {
        // 2. Fetch activities
        console.log(`[API] Fetching activities for session: ${sessionId}`);
        const activitiesResponse = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=5', {
            headers: { 'Authorization': `Bearer ${access_token}` }
        });

        if (!activitiesResponse.ok) {
            throw new Error(`Strava API error: ${activitiesResponse.status}`);
        }

        const activities = await activitiesResponse.json();

        // 3. Immediate Revocation (Fire and forget with internal error handling)
        fetch('https://www.strava.com/oauth/deauthorize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_token })
        }).catch(err => console.warn('[API] Deauth failed:', err));

        // 4. Lock & Queue Management (Atomic-focused logic)
        try {
            await redis.del(ACTIVE_TOKEN_KEY);

            if (sessionId) {
                const currentLockHolder = await redis.get<string>(LOCK_KEY);
                
                if (currentLockHolder === sessionId) {
                    // Transfer lock to next in queue
                    const nextInQueue = await redis.lpop<string>(QUEUE_KEY);
                    
                    if (nextInQueue) {
                        await redis.set(LOCK_KEY, nextInQueue, { ex: 30 });
                        console.log(`[Queue] Slot handed over to: ${nextInQueue}`);
                    } else {
                        await redis.del(LOCK_KEY);
                        console.log('[Queue] Lock released, queue empty.');
                    }
                }
            }
        } catch (redisError) {
            console.error('[Critical] Redis cleanup failed:', redisError);
        }

        return res.status(200).json({ activities });

    } catch (error: any) {
        console.error('[API Error]:', error.message);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
