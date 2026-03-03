/**
 * Calcula el Ritmo Máximo (Pace) asumiendo que Strava 
 * entrega la velocidad máxima en MPH (Millas por hora).
 */
export function calculateMaxPace(maxSpeedMph: number | undefined | null): string {
    if (!maxSpeedMph || maxSpeedMph <= 0) return "0:00";

    // 1. Convertir Millas/h a Km/h (Factor: 1.60934)
    const speedKmH = maxSpeedMph * 1.60934;

    // 2. Calcular minutos por kilómetro (Pace decimal)
    const paceDecimal = 60 / speedKmH;

    // 3. Desglosar en minutos y segundos
    const mins = Math.floor(paceDecimal);
    const secs = Math.round((paceDecimal - mins) * 60);

    // Retorna formato "M:SS" (Ej: "2:39")
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}
