import { Redis } from '@upstash/redis';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const timestamp = new Date().toISOString();
    const checks = {};
    let overallStatus = 'ok';

    // --- Check 1: Environment Variables ---
    const CLIENT_ID = process.env.Client_ID || process.env.VITE_STRAVA_CLIENT_ID || process.env.STRAVA_CLIENT_ID;
    const CLIENT_SECRET = process.env.Client_Secret || process.env.VITE_STRAVA_CLIENT_SECRET || process.env.STRAVA_CLIENT_SECRET;

    if (CLIENT_ID && CLIENT_SECRET) {
        checks.env = 'ok';
    } else {
        checks.env = 'missing_vars';
        overallStatus = 'degraded';
    }

    // --- Check 2: Strava API Reachability ---
    try {
        const stravaRes = await fetch('https://www.strava.com/api/v3/athlete', {
            method: 'GET',
            headers: { 'Authorization': 'Bearer health_check_no_token' },
            signal: AbortSignal.timeout(5000) // 5 second timeout
        });

        // 401 = Strava is UP (it correctly rejected our fake token)
        // Anything 5xx = Strava servers are down
        if (stravaRes.status === 401 || stravaRes.ok) {
            checks.strava = 'ok';
        } else {
            checks.strava = `degraded (HTTP ${stravaRes.status})`;
            overallStatus = 'degraded';
        }
    } catch (err) {
        checks.strava = `unreachable (${err.message})`;
        overallStatus = 'degraded';
    }

    // --- Check 3: Redis Connectivity ---
    const REDIS_CONFIGURED = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
    if (REDIS_CONFIGURED) {
        try {
            const redis = new Redis({
                url: process.env.UPSTASH_REDIS_REST_URL,
                token: process.env.UPSTASH_REDIS_REST_TOKEN
            });
            await redis.get('strava:slot:lock');
            checks.redis = 'ok';
        } catch (err) {
            checks.redis = `unreachable (${err.message})`;
            overallStatus = 'degraded';
        }
    } else {
        checks.redis = 'not_configured';
    }

    const httpStatus = overallStatus === 'ok' ? 200 : 503;
    return res.status(httpStatus).json({ status: overallStatus, checks, timestamp });
}
