import { Redis } from '@upstash/redis';
import fs from 'fs';
import path from 'path';

const LOCK_KEY = 'strava:slot:lock';
const QUEUE_KEY = 'strava:slot:queue';
const ACTIVE_TOKEN_KEY = 'strava:active_token';

export default async function handler(req, res) {
    
    // ☢️ NUCLEAR BYPASS: Read .env.local manually if process.env is failing us
    let url = process.env.UPSTASH_REDIS_REST_URL;
    let token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
        try {
            const pathsToTry = [
                path.join(process.cwd(), '.env.local'),
                path.join(process.cwd(), '.env'),
                path.join(process.cwd(), '..', '.env.local'),
                path.join(process.cwd(), '..', '.env'),
                path.resolve('.env.local'),
                path.resolve('.env')
            ];

            let targetPath = null;
            for (const p of pathsToTry) {
                if (fs.existsSync(p)) {
                    targetPath = p;
                    break;
                }
            }
            
            if (targetPath) {
                const envContent = fs.readFileSync(targetPath, 'utf8');
                const urlMatch = envContent.match(/UPSTASH_REDIS_REST_URL=["']?([^"'\n\r]+)/);
                const tokenMatch = envContent.match(/UPSTASH_REDIS_REST_TOKEN=["']?([^"'\n\r]+)/);
                if (urlMatch) url = urlMatch[1].replace(/['"]/g, '');
                if (tokenMatch) token = tokenMatch[1].replace(/['"]/g, '');
            }
        } catch (e) {
            console.error("[Admin] Manual env read failed:", e);
        }
    }

    const REDIS_CONFIGURED = !!(url && token);

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
        return res.status(200).json({ 
            success: true,
            redisMissing: true,
            message: 'Redis is not configured. Reset not necessary.'
        });
    }

    try {
        const redis = new Redis({
            url: url,
            token: token
        });

        // 🔍 DIAGNOSTICS: Check what we are about to clear
        const activeToken = await redis.get(ACTIVE_TOKEN_KEY);
        const lockHolder = await redis.get(LOCK_KEY);
        const queueSize = await redis.llen(QUEUE_KEY);

        let tokenRevoked = false;

        // Try to revoke the active token on Strava's side if we have it.
        if (activeToken) {
            console.log('[Admin] Found orphaned token in Redis. Attempting to deauthorize...');
            try {
                const stravaRes = await fetch('https://www.strava.com/oauth/deauthorize', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ access_token: activeToken })
                });
                tokenRevoked = stravaRes.ok;
                console.log(`[Admin] Strava deauth response: ${stravaRes.status}`);
            } catch (cleanupErr) {
                console.error('[Admin] Failed to deauthorize orphaned token on Strava:', cleanupErr);
            }
        }

        // 🔑 ALWAYS clear all control keys
        const keysDeleted = await redis.del(LOCK_KEY, QUEUE_KEY, ACTIVE_TOKEN_KEY);

        console.log(`[Admin] Reset complete. Keys deleted: ${keysDeleted}. Lock was held by: ${lockHolder || 'none'}. Queue size was: ${queueSize}`);

        return res.status(200).json({ 
            success: true,
            message: 'System reset successful.',
            hadActiveToken: !!activeToken,
            tokenRevoked: tokenRevoked,
            hadLock: !!lockHolder,
            queueCleared: queueSize > 0,
            queueSize: queueSize,
            details: 'The queue, locks, and any stored active tokens were purged.'
        });

    } catch (error) {
        console.error('[Admin] Error resetting system:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}

