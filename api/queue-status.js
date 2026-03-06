import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

const LOCK_KEY = 'strava:slot:lock';
const QUEUE_KEY = 'strava:slot:queue';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { sessionId } = req.query;

    if (!sessionId) {
        return res.status(400).json({ error: 'sessionId is required' });
    }

    try {
        // Check if the lock holder's slot is now free AND this session is next
        const lockHolder = await redis.get(LOCK_KEY);

        // If no one holds the lock, try to give it to whoever is first in the queue
        if (!lockHolder) {
            const nextInQueue = await redis.lindex(QUEUE_KEY, 0);

            if (nextInQueue === sessionId) {
                // This caller is next — give them the lock
                await redis.lpop(QUEUE_KEY);
                await redis.set(LOCK_KEY, sessionId, { ex: 45 });
                console.log(`[Queue] Session ${sessionId} advanced from queue to lock holder.`);
                return res.status(200).json({ sessionId, position: 0, estimatedWait: 0 });
            }
        }

        // Find position in queue
        const queue = await redis.lrange(QUEUE_KEY, 0, -1);
        const index = queue.indexOf(sessionId);

        if (index === -1) {
            // Not in queue and not lock holder — likely expired or already processed
            return res.status(200).json({ sessionId, position: -1, estimatedWait: 0 });
        }

        const position = index + 1;
        return res.status(200).json({
            sessionId,
            position,
            estimatedWait: position * 15
        });

    } catch (error) {
        console.error('[Queue] Error in queue-status:', error);
        // Graceful degradation: tell user they can proceed if Redis is down
        return res.status(200).json({ sessionId, position: 0, estimatedWait: 0 });
    }
}
