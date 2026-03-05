export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { code } = req.body;

        // El cliente (tu frontend) solo necesita enviar el código de autorización
        // Nosotros empujamos el ID y Secret de forma segura desde el backend de Vercel
        const CLIENT_ID = process.env.VITE_STRAVA_CLIENT_ID || process.env.STRAVA_CLIENT_ID;
        const CLIENT_SECRET = process.env.VITE_STRAVA_CLIENT_SECRET || process.env.STRAVA_CLIENT_SECRET;

        const stravaResponse = await fetch('https://www.strava.com/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                code: code,
                grant_type: 'authorization_code'
            })
        });

        const data = await stravaResponse.json();

        // Si Strava devuelve un error, lo enviamos al frontend
        if (!stravaResponse.ok) {
            return res.status(stravaResponse.status).json(data);
        }

        // Éxito: Le devolvemos el payload al frontend (que contiene el access_token)
        return res.status(200).json(data);

    } catch (error) {
        console.error("Error exchanging Strava token:", error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
