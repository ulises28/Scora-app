export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { refresh_token } = req.body;

        if (!refresh_token) {
            return res.status(400).json({ error: 'Missing refresh_token' });
        }

        const CLIENT_ID = process.env.Client_ID || process.env.VITE_STRAVA_CLIENT_ID || process.env.STRAVA_CLIENT_ID;
        const CLIENT_SECRET = process.env.Client_Secret || process.env.VITE_STRAVA_CLIENT_SECRET || process.env.STRAVA_CLIENT_SECRET;

        const stravaResponse = await fetch('https://www.strava.com/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                grant_type: 'refresh_token',
                refresh_token: refresh_token
            })
        });

        const data = await stravaResponse.json();

        if (!stravaResponse.ok) {
            return res.status(stravaResponse.status).json(data);
        }

        return res.status(200).json(data);

    } catch (error) {
        console.error("Error refreshing Strava token:", error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
