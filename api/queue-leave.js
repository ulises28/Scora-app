import { Redis } from '@upstash/redis';

const LOCK_KEY = 'strava:slot:lock';
const QUEUE_KEY = 'strava:slot:queue';

/**
 * POST { sessionId }
 * Releases the Strava slot if this session holds the lock (or removes it from the wait queue).
 * No admin credentials — only the session that joined may leave. Used when OAuth is Cancelled.
 */
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const REDIS_CONFIGURED = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
    if (!REDIS_CONFIGURED) {
        return res.status(200).json({ ok: true, skipped: true });
    }

    let body = req.body;
    if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
    }
    const sessionId = body?.sessionId;
    if (!sessionId) {
        return res.status(400).json({ error: 'sessionId required' });
    }

    const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN
    });

    try {
        const holder = await redis.get(LOCK_KEY);
        let released = false;
        if (holder && String(holder) === String(sessionId)) {
            await redis.del(LOCK_KEY);
            released = true;
            console.log(`[Queue] Session ${sessionId} released the lock (cancelled).`);
        }
        // Drop from wait queue if present
        try {
            await redis.lrem(QUEUE_KEY, 0, sessionId);
        } catch { /* older redis clients */ }

        return res.status(200).json({ ok: true, released });
    } catch (error) {
        console.error('[Queue] queue-leave error:', error);
        return res.status(200).json({ ok: true, released: false });
    }
}
