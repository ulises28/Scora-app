import { showScreen } from './Navigation.js';
import {
    WeeklyActivity, toWeeklyActivity, aggregateWeek, validateDayRange,
    SportFilter, Weekday, WEEKDAYS,
} from '../utils/weeklyOverlay';
import { drawTemplate } from '../features/editor/CanvasPainter.js';
import { copyCanvasToClipboard, saveCanvasAsPng } from '../features/editor/StickerActions.js';

const WEEKLY_STICKERS = [
    { id: 'weekly-summary', label: 'Weekly Summary' },
    { id: 'day-recap', label: 'Day Recap' },
];

interface WeeklyConfig {
    sport: SportFilter;
    start: Weekday;
    end: Weekday;
    color: string;
    stickerId: string;
}

const cfg: WeeklyConfig = {
    sport: 'all',
    start: 'Mon',
    end: 'Sun',
    color: 'white',
    stickerId: 'weekly-summary',
};

let activities: WeeklyActivity[] = [];

export function initWeeklySection(rawActivities: any[]) {
    activities = rawActivities.map(toWeeklyActivity);

    // Home button → weekly picker
    const btn = document.getElementById('btn-weekly');
    if (btn && !btn.dataset.wired) {
        btn.dataset.wired = '1';
        btn.addEventListener('click', () => {
            renderWeeklyGrid();
            showScreen('screen-weekly');
        });
    }

    // Back from weekly picker → home
    // Back from weekly editor → weekly picker (handled in wireEditor)
    wireEditor();
}

function renderWeeklyGrid() {
    const grid = document.getElementById('weekly-sticker-grid');
    if (!grid) return;
    grid.innerHTML = '';
    WEEKLY_STICKERS.forEach((s) => {
        const card = document.createElement('button');
        card.className = 'sticker-grid-card';
        card.dataset.testid = `weekly-sticker-${s.id}`;
        card.innerHTML = `<canvas width="360" height="640"></canvas><span>${s.label}</span>`;
        const canvas = card.querySelector('canvas')!;
        renderMini(canvas, s.id);
        card.addEventListener('click', () => {
            cfg.stickerId = s.id;
            showScreen('screen-weekly-editor');
            renderPreview();
        });
        grid.appendChild(card);
    });
}

function renderMini(canvas: HTMLCanvasElement, stickerId: string) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#16181d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    void drawTemplate(canvas.id || 'weekly-mini', buildStats(), stickerId, 'white', true, false);
}

function buildStats() {
    const range = { start: cfg.start, end: cfg.end };
    // Anchor on the most recent activity date so mock data (any month) populates buckets.
    // Anchoring on new Date() with old fixtures yields empty weeks (P0 pitfall).
    const latest = activities.reduce((acc, a) => {
        const d = new Date(a.date);
        return (!acc || d > acc) ? d : acc;
    }, null as Date | null);
    const week = aggregateWeek(activities, range, cfg.sport, latest ?? undefined);
    const totalM = week.reduce((a, d) => a + d.distanceM, 0);
    const totalSec = week.reduce((a, d) => a + d.movingSec, 0);
    const km = (totalM / 1000).toFixed(1).replace(/\.0$/, '');
    const weekly = week.map((d) => ({
        day: d.weekday,
        value: d.distanceM > 0 ? `${(d.distanceM / 1000).toFixed(1).replace(/\.0$/, '')}km` : `${Math.round(d.movingSec / 60)}min`,
    }));
    return {
        distanceVal: km,
        distanceUnit: 'km',
        durationVal: String(Math.round(totalSec / 60)),
        durationUnit: 'min',
        weekly,
        weeklyTotal: km,
        weeklyUnit: 'km',
        weeklyLabel: cfg.sport === 'all' ? 'Weekly Distance' : `Weekly ${cfg.sport === 'run' ? 'Run' : cfg.sport === 'ride' ? 'Ride' : 'Workout'} Distance`,
        dayRecapDate: week.length ? week[0].dateLabel : '',
        dayRecapRows: week.flatMap((d) =>
            d.activities.map((a) => ({
                icon: a.sport,
                label: a.title,
                value: a.distanceM > 0 ? `${(a.distanceM / 1000).toFixed(1)} km` : `${Math.round(a.movingSec / 60)} min`,
            }))
        ),
    };
}

function renderPreview() {
    const canvas = document.getElementById('weeklyStoryCanvas') as HTMLCanvasElement | null;
    if (!canvas) { console.log('[weekly] no canvas'); return; }
    const stats = buildStats();
    void drawTemplate(canvas.id, stats, cfg.stickerId, cfg.color, true, false);
}

function wireEditor() {
    const sportChips = document.getElementById('wo-sport-chips');
    if (sportChips && !sportChips.dataset.wired) {
        sportChips.dataset.wired = '1';
        sportChips.addEventListener('click', (e) => {
            const t = (e.target as HTMLElement).closest('.toggle-opt') as HTMLElement | null;
            if (!t) return;
            sportChips.querySelectorAll('.toggle-opt').forEach((c) => c.classList.remove('active'));
            t.classList.add('active');
            // Slide thumb (4 options = 25% each)
            const thumb = sportChips.querySelector('.wo-thumb') as HTMLElement | null;
            const opts = Array.from(sportChips.querySelectorAll('.toggle-opt'));
            const idx = opts.indexOf(t);
            if (thumb && idx >= 0) thumb.style.transform = `translateX(${idx * 100}%)`;
            cfg.sport = t.dataset.val as SportFilter;
            renderPreview();
        });
    }

    const startSel = document.getElementById('wo-day-start') as HTMLSelectElement | null;
    const endSel = document.getElementById('wo-day-end') as HTMLSelectElement | null;
    const warn = document.getElementById('wo-range-warning');

    function onDayChange() {
        if (!startSel || !endSel) return;
        const st = startSel.value as Weekday;
        const en = endSel.value as Weekday;
        const ok = validateDayRange({ start: st, end: en }).ok;
        if (warn) warn.classList.toggle('hidden', ok);
        if (ok) {
            cfg.start = st;
            cfg.end = en;
            renderPreview();
        }
    }
    if (startSel && !startSel.dataset.wired) {
        startSel.dataset.wired = '1';
        startSel.addEventListener('change', onDayChange);
    }
    if (endSel && !endSel.dataset.wired) {
        endSel.dataset.wired = '1';
        endSel.addEventListener('change', onDayChange);
    }

    const colorInput = document.getElementById('wo-color') as HTMLInputElement | null;
    const colorSwatch = document.getElementById('wo-color-swatch');
    const colorHex = document.getElementById('wo-color-hex');
    if (colorInput && !colorInput.dataset.wired) {
        colorInput.dataset.wired = '1';
        const updateColorUI = (val: string) => {
            cfg.color = val;
            if (colorSwatch) colorSwatch.style.background = val;
            if (colorHex) colorHex.textContent = val.toUpperCase();
            renderPreview();
        };
        colorInput.addEventListener('input', () => updateColorUI(colorInput.value));
    }

    const copyBtn = document.getElementById('wo-copy');
    if (copyBtn && !copyBtn.dataset.wired) {
        copyBtn.dataset.wired = '1';
        copyBtn.addEventListener('click', () => {
            copyCanvasToClipboard(document.getElementById('weeklyStoryCanvas') as HTMLCanvasElement);
        });
    }
    const saveBtn = document.getElementById('wo-save');
    if (saveBtn && !saveBtn.dataset.wired) {
        saveBtn.dataset.wired = '1';
        saveBtn.addEventListener('click', () => {
            saveCanvasAsPng(document.getElementById('weeklyStoryCanvas') as HTMLCanvasElement, 'scora-weekly');
        });
    }
}
