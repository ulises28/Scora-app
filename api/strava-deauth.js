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

        // Successfully revoked token
        return res.status(200).json(data);

    } catch (error) {
        console.error("Error revoking Strava token:", error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
