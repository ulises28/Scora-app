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
        // Nominatim requires an identifier, but 'User-Agent' is a forbidden header in browsers.
        // The browser will send its own User-Agent and Referer automatically.
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
        
        console.log(`[Geo] Requesting high-fidelity location for: ${lat}, ${lng}`);
        const response = await fetch(url);

        if (!response.ok) {
            console.error(`[Geo] API Error: ${response.status}`);
            return null;
        }

        const data = await response.json();
        console.log("[Geo] Reverse Geocoding Success:", data.address?.city_district || data.address?.city || "Found");
        const addr = data.address || {};

        // 1. Extract potential district names (Nominatim uses different keys by region)
        const borough = addr.borough;
        const district = addr.city_district || addr.district || addr.suburb_district;
        const county = addr.county;
        const city = addr.city || addr.town || addr.village;
        const state = addr.state;
        const country = addr.country;

        // 2. Determine the most specific "Delegación/Alcaldía" label
        // We prioritize borough/district and filter out names that are identical to the State.
        let primaryLabel = "";
        
        // Priority Chain: Borough -> District -> County (if not generic) -> City
        if (borough && borough !== state) {
            primaryLabel = borough;
        } else if (district && district !== state) {
            primaryLabel = district;
        } else if (county && county !== state && county !== city) {
            primaryLabel = county;
        } else {
            // Fallback to City or State
            primaryLabel = city || state || country || "SECRET LOCATION";
        }

        return {
            alcaldia_district: primaryLabel,
            state: state || city || "Unknown",
            country: country || "Unknown"
        };
    } catch (error) {
        console.error("[Geo] Reverse geocoding failed:", error);
        return null;
    }
}
