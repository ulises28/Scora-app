/**
 * geoUtils.ts — High Fidelity Geographic Intelligence
 * Ported from user's Python logic (Nominatim Reverse Geocoding)
 */

export interface AdministrativeLocation {
    alcaldia_district: string;
    state: string;
    country: string;
}

/**
 * Performs reverse geocoding via Nominatim to extract administrative districts.
 * Priority: city_district (Alcaldía) -> county -> city
 */
export async function getAdministrativeLocation(lat: number, lng: number): Promise<AdministrativeLocation | null> {
    try {
        // Nominatim requires a User-Agent and has a rate limit of 1 req/sec.
        // We use a custom user-agent for scora.
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'scora-high-fidelity-v1.0'
            }
        });

        if (!response.ok) return null;

        const data = await response.json();
        const addr = data.address || {};

        // 1. Determine District/Alcaldía (Primary Goal)
        // Hierarchy: city_district -> county -> city -> town -> village
        const district = addr.city_district || addr.county || addr.city || addr.town || addr.village;
        
        // 2. Determine State
        const state = addr.state || "Unknown State";

        // 3. Determine Country
        const country = addr.country || "Unknown Country";

        return {
            alcaldia_district: district || state || "Unknown",
            state: state,
            country: country
        };
    } catch (error) {
        console.error("[Geo] Reverse geocoding failed:", error);
        return null;
    }
}
