import { decodePolyline } from '../features/editor/CanvasUtils';

/** Sport → accent hue used for the card’s visual language. */
const SPORT_STYLES: Record<string, { label: string; hue: number; glyph: string }> = {
    Run: { label: 'Run', hue: 165, glyph: '▶' },
    VirtualRun: { label: 'Run', hue: 165, glyph: '▶' },
    Ride: { label: 'Ride', hue: 20, glyph: '◎' },
    VirtualRide: { label: 'Ride', hue: 20, glyph: '◎' },
    EBikeRide: { label: 'E-Bike', hue: 20, glyph: '◎' },
    GravelRide: { label: 'Gravel', hue: 20, glyph: '◎' },
    MountainBikeRide: { label: 'MTB', hue: 20, glyph: '◎' },
    Swim: { label: 'Swim', hue: 200, glyph: '≈' },
    OpenWaterSwim: { label: 'Swim', hue: 200, glyph: '≈' },
    Walk: { label: 'Walk', hue: 45, glyph: '●' },
    Hike: { label: 'Hike', hue: 45, glyph: '▲' },
    Workout: { label: 'Workout', hue: 280, glyph: '◆' },
    WeightTraining: { label: 'Strength', hue: 280, glyph: '◆' },
    Yoga: { label: 'Yoga', hue: 300, glyph: '◇' },
    Crossfit: { label: 'CrossFit', hue: 280, glyph: '◆' },
    FunctionalStrength: { label: 'Strength', hue: 280, glyph: '◆' },
};

function sportStyle(type: string) {
    return SPORT_STYLES[type] || { label: type || 'Activity', hue: 165, glyph: '●' };
}

/**
 * Mini route preview as an inline SVG path (safe: path data only, no HTML injection).
 * Returns null when there is no usable polyline.
 */
function buildRoutePreviewSvg(polyline: string | undefined): SVGElement | null {
    if (!polyline) return null;
    const points = decodePolyline(polyline);
    if (points.length < 2) return null;

    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    for (const [lat, lng] of points) {
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
    }

    const W = 120;
    const H = 64;
    const pad = 6;
    const latRange = maxLat - minLat || 1;
    const lngRange = maxLng - minLng || 1;
    const scale = Math.min((W - pad * 2) / lngRange, (H - pad * 2) / latRange);
    const xOff = (W - lngRange * scale) / 2;
    const yOff = (H - latRange * scale) / 2;

    const d = points
        .map(([lat, lng], i) => {
            const x = (lng - minLng) * scale + xOff;
            const y = H - ((lat - minLat) * scale + yOff);
            return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' ');

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('class', 'card-route');
    svg.setAttribute('aria-hidden', 'true');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '2.5');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(path);
    return svg;
}

/**
 * Activity selection card — premium card-grid tile with sport badge,
 * stat hierarchy, and an optional mini route preview.
 * Built with DOM APIs (textContent) so activity titles never hit innerHTML.
 */
export function createActivityCard(stats: any, onClick: () => void) {
    const card = document.createElement('div');
    card.className = 'activity-card';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');

    const sport = sportStyle(stats.type);
    card.dataset.sport = sport.label.toLowerCase();
    card.style.setProperty('--sport-hue', String(sport.hue));

    // Visual layer: route preview only — no decorative blob when there's no map
    const visual = document.createElement('div');
    visual.className = 'card-visual';
    const route = buildRoutePreviewSvg(stats.polyline);
    if (route) {
        visual.appendChild(route);
        visual.classList.add('has-route');
        card.appendChild(visual);
    }

    // Sport pill
    const badge = document.createElement('span');
    badge.className = 'card-sport-badge';
    const glyph = document.createElement('span');
    glyph.className = 'card-sport-glyph';
    glyph.textContent = sport.glyph;
    const sportLabel = document.createElement('span');
    sportLabel.className = 'card-sport-label';
    sportLabel.textContent = sport.label;
    badge.appendChild(glyph);
    badge.appendChild(sportLabel);
    card.appendChild(badge);

    // Content
    const info = document.createElement('div');
    info.className = 'card-info';

    const title = document.createElement('span');
    title.className = 'card-title';
    title.textContent = String(stats.title ?? '');

    const meta = document.createElement('span');
    meta.className = 'card-meta';
    meta.textContent = `${stats.mainValue} • ${stats.type}`;

    info.appendChild(title);
    info.appendChild(meta);

    // Secondary line: pace/speed or duration + date when available
    const secondary = document.createElement('span');
    secondary.className = 'card-secondary';
    const parts: string[] = [];
    if (stats.subValue) parts.push(String(stats.subValue));
    if (stats.date) parts.push(String(stats.date));
    if (parts.length) {
        secondary.textContent = parts.join(' · ');
        info.appendChild(secondary);
    }

    card.appendChild(info);

    const arrow = document.createElement('span');
    arrow.className = 'card-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '→';
    card.appendChild(arrow);

    card.addEventListener('click', onClick);
    card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
        }
    });
    return card;
}
