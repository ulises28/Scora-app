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

    const { access_token, sessionId, activity_id }: any = req.body;

    if (!access_token) {
        return res.status(400).json({ error: 'Access token is required' });
    }

    try {
        let responseData: any = null;

        if (activity_id) {
            // Fetch detailed activity
            console.log(`[Detailed] Fetching activity ${activity_id}`);
            const detailResponse = await fetch(`https://www.strava.com/api/v3/activities/${activity_id}`, {
                headers: { 'Authorization': `Bearer ${access_token}` }
            });
            if (!detailResponse.ok) {
                console.error(`[API Error] Strava Detail API returned ${detailResponse.status}`);
                return res.status(detailResponse.status).json({
                    error: 'Strava Detail API Error',
                    message: `Strava Detail API error: ${detailResponse.status}`
                });
            }
            responseData = { activity: await detailResponse.json() };
        } else {
            // Fetch activities list
            console.log(`[API] Fetching activities for session: ${sessionId}`);
            const activitiesResponse = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=10', {
                headers: { 'Authorization': `Bearer ${access_token}` }
            });
            if (!activitiesResponse.ok) {
                console.error(`[API Error] Strava API returned ${activitiesResponse.status}`);
                return res.status(activitiesResponse.status).json({
                    error: 'Strava API Error',
                    message: `Strava API error: ${activitiesResponse.status}`
                });
            }
            responseData = { activities: await activitiesResponse.json() };
        }

        // 4. Redis Queue Handover (Slot releasing)
        // Note: Instead of releasing the lock here, we allow the frontend to call /api/strava-deauth
        // when it's fully finished with all data (list + details). This ensures the token works for pre-fetching.

        return res.status(200).json(responseData);

    } catch (error: any) {
        console.error('[API Error]:', error.message);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
