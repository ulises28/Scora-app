import { Redis } from '@upstash/redis';
import { randomUUID } from 'crypto';

const LOCK_KEY = 'strava:slot:lock';
const QUEUE_KEY = 'strava:slot:queue';
const LOCK_TTL_SECONDS = 45;

// Check if Redis is configured at module load time
const REDIS_CONFIGURED = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // ⚡ Fast path: if Redis is not configured, skip the queue entirely
    if (!REDIS_CONFIGURED) {
        return res.status(200).json({ sessionId: 'fallback', position: 0, estimatedWait: 0 });
    }

    const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN
    });

    try {
        const sessionId = randomUUID();

        // Try to acquire the lock atomically. NX = only set if Not eXists.
        // If the lock is free, we become the lock holder and go immediately (position 0).
        const acquired = await redis.set(LOCK_KEY, sessionId, {
            nx: true,
            ex: LOCK_TTL_SECONDS
        });

        if (acquired) {
            // We got the lock — caller can proceed directly to OAuth
            console.log(`[Queue] Session ${sessionId} acquired the lock immediately.`);
            return res.status(200).json({
                sessionId,
                position: 0,
                estimatedWait: 0
            });
        }

        // Lock is held by someone else — add this session to the waiting queue
        const queueLength = await redis.rpush(QUEUE_KEY, sessionId);
        const position = queueLength; // 1-indexed position in line

        console.log(`[Queue] Session ${sessionId} queued at position ${position}.`);

        return res.status(200).json({
            sessionId,
            position,
            estimatedWait: position * 15 // ~15s per athlete slot
        });

    } catch (error) {
        console.error('[Queue] Error in queue-join:', error);
        // Graceful degradation: if Redis is unavailable, let the user through
        return res.status(200).json({
            sessionId: 'fallback',
            position: 0,
            estimatedWait: 0
        });
    }
}
