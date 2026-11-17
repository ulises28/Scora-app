import { showScreen } from './Navigation.js';
import {
    WeeklyActivity, toWeeklyActivity, aggregateWeek, buildWeekSummaryStats,
    SportClass, SPORTS, Weekday, WEEKDAYS,
} from '../utils/weeklyOverlay';
import { drawTemplate } from '../features/editor/CanvasPainter.js';
import { copyCanvasToClipboard, saveCanvasAsPng } from '../features/editor/StickerActions.js';

const WEEKLY_STICKERS = [
    { id: 'weekly-summary', label: 'Weekly Summary' },
    { id: 'day-recap', label: 'Day Recap' },
];

interface WeeklyConfig {
    /** Checked days (checkbox set — not a start→end range). */
    days: Weekday[];
    /** Checked sports (checkbox set). */
    sports: SportClass[];
    color: string;
    stickerId: string;
}

const cfg: WeeklyConfig = {
    days: [...WEEKDAYS],
    sports: [...SPORTS],
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
    // Anchor on the most recent activity date so mock data (any month) populates buckets.
    // Anchoring on new Date() with old fixtures yields empty weeks (P0 pitfall).
    const latest = activities.reduce((acc, a) => {
        const d = new Date(a.date);
        return (!acc || d > acc) ? d : acc;
    }, null as Date | null);
    const week = aggregateWeek(activities, { days: cfg.days, sports: cfg.sports }, latest ?? undefined);
    const sum = buildWeekSummaryStats(week);
    const totalM = week.reduce((a, d) => a + d.distanceM, 0);
    const totalSec = week.reduce((a, d) => a + d.movingSec, 0);
    return {
        distanceVal: (totalM / 1000).toFixed(2),
        distanceUnit: 'km',
        durationVal: String(Math.round(totalSec / 60)),
        durationUnit: 'min',
        weekly: sum.weekly,
        weeklyTotal: sum.weeklyTotal,
        weeklyUnit: sum.weeklyUnit,
        weeklyLabel: sum.weeklyLabel,
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

/** Checkbox chip row: toggles membership in `selected`. Keeps ≥1 item checked. */
function wireCheckRow(rowId: string, selected: string[], allVal: string | null, onChange: () => void) {
    const row = document.getElementById(rowId);
    if (!row || row.dataset.wired) return;
    row.dataset.wired = '1';
    const values = () => Array.from(row.querySelectorAll<HTMLElement>('.wo-check[data-val]'))
        .map(c => c.dataset.val!)
        .filter(x => x !== allVal);
    const sync = () => {
        const allOn = allVal != null && values().every(v => selected.includes(v));
        row.querySelectorAll<HTMLElement>('.wo-check[data-val]').forEach((c) => {
            const v = c.dataset.val!;
            c.classList.toggle('active', allVal && v === allVal ? allOn : selected.includes(v));
        });
    };
    row.addEventListener('click', (e) => {
        const t = (e.target as HTMLElement).closest('.wo-check') as HTMLElement | null;
        if (!t) return;
        const v = t.dataset.val!;
        const others = values();
        if (allVal && v === allVal) {
            // "All" on ⇔ every option checked.
            selected.length = 0;
            selected.push(...others);
        } else if (selected.includes(v)) {
            if (selected.length === 1) return; // keep ≥1 checked
            selected.splice(selected.indexOf(v), 1);
        } else {
            selected.push(v);
        }
        sync();
        onChange();
    });
    sync();
}

function wireEditor() {
    wireCheckRow('wo-sport-chips', cfg.sports, 'all', renderPreview);
    wireCheckRow('wo-day-chips', cfg.days, null, renderPreview);

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
