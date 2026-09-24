import { ACTIVE_STICKER_LIST, ARCHIVED_STICKER_LIST, STICKER_REGISTRY } from './features/editor/StickerRegistry';
import { drawTemplate, exportCanvas } from './features/editor/CanvasPainter';
import { StickerStats } from './api/strava';

export interface HarnessPreset {
    id: string;
    name: string;
    title: string;
    distance: string;
    duration: string;
    pace: string;
    paceUnit: string;
    hr: string;
    calories: string;
    location: string;
    date: string;
    startTime: string;
    dayName: string;
    dayAndNumber: string;
    avgTemp: string;
    maxPace: string;
    type: string;
    hasMap: boolean;
    polyline: string;
    recommendedTemplates?: string[];
}

// --- EXPANDED ACTIVITY PRESETS (INCLUDING EDGE CASES & STRESS TESTS) ---
const PRESETS: Record<string, HarnessPreset> = {
    lululemon: {
        id: "lululemon",
        name: "Run: Lululemon 10k (Standard)",
        title: "Lululemon 10k",
        distance: "10.05 km",
        duration: "41:46",
        pace: "4:09",
        paceUnit: "/km",
        hr: "167",
        calories: "1068",
        location: "Cuauhtémoc",
        date: "March 29, 2026",
        startTime: "07:30 AM",
        dayName: "Sunday",
        dayAndNumber: "Sun 29",
        avgTemp: "17",
        maxPace: "3:48",
        type: "Run",
        hasMap: true,
        polyline: "yhpuBrtl|QZWr@[NKRIP]@MEEg@Ko@Ck@GkAIkJ{@a@BmGg@OCKEKU?_@F]TeDj@wFPeCP{Al@aHvAwQNkAViEz@yIb@aGRmBLkBR{Dd@qFBmAG}@Kq@eByEs@eBWaA[w@Qk@{@oBOs@MeAEOa@g@m@eAmDuJUc@[u@c@yAMMC@?FF\\v@dB~CvId@hALd@VfBJP\\`@T`@jAdDdAfCRr@dAnCt@fBHZFd@J|@?`@q@pHIh@KnAQrAIbAEjAKj@Y`DKTMFWB}CWe@?i@DsARuBp@wAp@_Az@g@j@u@jAYt@Qx@ObB@pBD|@Ht@f@lDP~@`@pAdBfFvAnI`@lBh@bBN`@^n@NPPLL@DAHKDKZqEBMBADF?L]fFo@hGAZi@pGE|@S`BYdES~ACp@[bDYjE_@rDG`AQ`BEbASbBKbAIRKF_@@u@NiAf@UR}@pASl@Gj@AjBSxB@JDHpAL`@PBA?WPqAR_AN]bA_BZo@Jo@TyBLIzAAp@MNOh@qALQb@_@HSB_@ES]iAKQKK_@UiA_@GOAe@Bg@ZgDDw@J_Af@kHLcADu@XyC^eFFWLKNG^@rCXrARxBTvAHz@@p@CdBLtCHJL?HCFCDo@X_@^"
    },
    carrera_mañana: {
        id: "carrera_mañana",
        name: "Run: Carrera por la mañana",
        title: "Carrera por la mañana",
        distance: "10.40 km",
        duration: "59:14",
        pace: "5:41",
        paceUnit: "/km",
        hr: "123",
        calories: "1075",
        location: "Roma Norte, CDMX",
        date: "April 22, 2026",
        startTime: "06:15 AM",
        dayName: "Wednesday",
        dayAndNumber: "Wed 22",
        avgTemp: "14",
        maxPace: "4:50",
        type: "Run",
        hasMap: true,
        polyline: "yhpuBrtl|QZWr@[NKRIP]@MEEg@Ko@Ck@GkAIkJ{@a@BmGg@OCKEKU?_@F]TeDj@wFPeCP{Al@aHvAwQNkAViEz@yIb@aGRmBLkBR{Dd@qFBmAG}@Kq@eByEs@eBWaA[w@Qk@{@oBOs@MeAEOa@g@m@eAmDuJUc@[u@c@yAMMC@?FF"
    },
    vuelta_ciclista: {
        id: "vuelta_ciclista",
        name: "Ride: Vuelta ciclista matutina",
        title: "Vuelta ciclista matutina",
        distance: "25.40 km",
        duration: "52:18",
        pace: "29.1",
        paceUnit: "km/h",
        hr: "142",
        calories: "620",
        location: "Paseo de la Reforma",
        date: "March 24, 2026",
        startTime: "08:00 AM",
        dayName: "Tuesday",
        dayAndNumber: "Tue 24",
        avgTemp: "21",
        maxPace: "44.5",
        type: "Ride",
        hasMap: true,
        polyline: "yhpuBrtl|QZWr@[NKRIP]@MEEg@Ko@Ck@GkAIkJ{@a@BmGg@OCKEKU?_@F]TeDj@wFPeCP{Al@aHvAwQNkAViEz@yIb@aGRmBLkBR{Dd@qFBmAG}@Kq@eByEs@eBWaA[w@Qk@{@oBOs@MeAEOa@g@m@eAmDuJUc@[u@c@yAMMC@?FF\\v@dB~CvId@hALd@VfBJP\\`@T`@jAdDdAfCRr@dAnCt@fBHZFd@J"
    },
    pesas: {
        id: "pesas",
        name: "Gym: Entrenamiento con pesas (No Map / No Dist)",
        title: "Entrenamiento de Fuerza",
        distance: "0.00 km",
        duration: "1h 11m",
        pace: "122",
        paceUnit: "bpm",
        hr: "122",
        calories: "450",
        location: "Gym Polanco, CDMX",
        date: "March 2, 2026",
        startTime: "06:30 PM",
        dayName: "Monday",
        dayAndNumber: "Mon 02",
        avgTemp: "22",
        maxPace: "155",
        type: "WeightTraining",
        hasMap: false,
        polyline: ""
    },
    stress_text: {
        id: "stress_text",
        name: "Edge Case: Ultra Long Strings (Overflow Test)",
        title: "Maratón Internacional Nocturna de la Ciudad de México - Edición Especial Bicentenario 2026",
        distance: "42.195 km",
        duration: "3h 48m 12s",
        pace: "5:24",
        paceUnit: "min/km",
        hr: "174",
        calories: "3250",
        location: "Avenida Paseo de la Reforma 222, Cuauhtémoc, Ciudad de México",
        date: "September 30, 2026",
        startTime: "05:00:00 AM",
        dayName: "Wednesday",
        dayAndNumber: "Wed 30",
        avgTemp: "12",
        maxPace: "4:10",
        type: "Run",
        hasMap: true,
        polyline: "yhpuBrtl|QZWr@[NKRIP]@MEEg@Ko@Ck@GkAIkJ{@a@BmGg@OCKEKU?_@F]TeDj@wFPeCP{Al@aHvAwQNkAViEz@yIb@aGRmBLkBR{Dd@qFBmAG}@Kq@eByEs@eBWaA[w@Qk@{@oBOs@MeAEOa@g@m@eAmDuJUc@[u@c@yAMMC@?FF"
    },
    stress_numbers: {
        id: "stress_numbers",
        name: "Edge Case: Nulls / Empty Metrics (Zero State)",
        title: "Paseo Rápido",
        distance: "0.00 km",
        duration: "00:00",
        pace: "",
        paceUnit: "",
        hr: "",
        calories: "",
        location: "",
        date: "Today",
        startTime: "12:00 PM",
        dayName: "Today",
        dayAndNumber: "Today",
        avgTemp: "",
        maxPace: "",
        type: "Workout",
        hasMap: false,
        polyline: ""
    }
};

// --- DOM ELEMENTS ---
const selectTemplate = document.getElementById('select-template') as HTMLSelectElement;
const selectPreset = document.getElementById('select-preset') as HTMLSelectElement;
const selectTextColor = document.getElementById('select-text-color') as HTMLSelectElement;
const selectBackground = document.getElementById('select-background') as HTMLSelectElement;
const groupCustomBg = document.getElementById('group-custom-bg') as HTMLDivElement;
const inputBgFile = document.getElementById('input-bg-file') as HTMLInputElement;
const checkLogo = document.getElementById('check-logo') as HTMLInputElement;

const inputTitle = document.getElementById('input-title') as HTMLInputElement;
const inputDistance = document.getElementById('input-distance') as HTMLInputElement;
const inputDuration = document.getElementById('input-duration') as HTMLInputElement;
const inputPace = document.getElementById('input-pace') as HTMLInputElement;
const inputPaceUnit = document.getElementById('input-pace-unit') as HTMLInputElement;
const inputHr = document.getElementById('input-hr') as HTMLInputElement;
const inputCalories = document.getElementById('input-calories') as HTMLInputElement;
const inputLocation = document.getElementById('input-location') as HTMLInputElement;
const inputDate = document.getElementById('input-date') as HTMLInputElement;

const btnExport = document.getElementById('btn-export') as HTMLButtonElement;
const btnRunAudit = document.getElementById('btn-run-audit') as HTMLButtonElement;
const auditStatus = document.getElementById('audit-status') as HTMLSpanElement;
const auditResultsContainer = document.getElementById('audit-results-container') as HTMLDivElement;
const canvasContainer = document.querySelector('.canvas-container') as HTMLDivElement;

// Dynamic preset state store to allow full customisation
let currentPresetState: HarnessPreset = { ...PRESETS.lululemon };

// --- INITIALIZE DROPDOWNS ---
function initDropdowns() {
    // Populate templates dropdown
    selectTemplate.innerHTML = '';
    ACTIVE_STICKER_LIST.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = `${s.id} (Active)`;
        selectTemplate.appendChild(opt);
    });

    ARCHIVED_STICKER_LIST.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = `[Archived] ${s.id}`;
        selectTemplate.appendChild(opt);
    });

    // Populate preset dropdown
    selectPreset.innerHTML = '';
    Object.keys(PRESETS).forEach(k => {
        const opt = document.createElement('option');
        opt.value = k;
        opt.textContent = PRESETS[k].name;
        selectPreset.appendChild(opt);
    });

    // Populate default preset values
    loadPreset('lululemon');
}

// --- LOAD PRESET DATA ---
function loadPreset(presetKey: string) {
    const preset = PRESETS[presetKey];
    if (!preset) return;

    currentPresetState = { ...preset };

    inputTitle.value = preset.title;
    inputDistance.value = preset.distance;
    inputDuration.value = preset.duration;
    inputPace.value = preset.pace;
    inputPaceUnit.value = preset.paceUnit;
    inputHr.value = preset.hr;
    inputCalories.value = preset.calories;
    inputLocation.value = preset.location;
    inputDate.value = preset.date;
}

// --- COMPATIBILITY VALIDATION ---
function validateTemplateCompatibility(templateId: string, stats: StickerStats): { compatible: boolean; warning?: string } {
    const def = STICKER_REGISTRY[templateId];
    if (!def) return { compatible: true };

    if (def.features?.map && !stats.hasMap) {
        return { compatible: false, warning: `⚠️ "${templateId}" requiere mapa (polyline), pero la actividad no tiene ruta GPS.` };
    }
    if (def.features?.distance && !stats.hasDistance) {
        return { compatible: false, warning: `⚠️ "${templateId}" está diseñado para actividades de distancia, pero la distancia es 0.00.` };
    }
    if (def.category === 'distance' && stats.type === 'WeightTraining') {
        return { compatible: false, warning: `⚠️ Template "${templateId}" es de categoría "distance", incompatible con deportes estáticos.` };
    }
    return { compatible: true };
}

// --- RENDER DRAW LOOP ---
async function triggerRender() {
    const templateId = selectTemplate.value;
    const textColor = selectTextColor.value;
    const showLogo = checkLogo.checked;

    // Split numeric values from units
    const rawDist = inputDistance.value;
    const distanceVal = rawDist.replace(/[^\d.]/g, '');
    const hasDistance = parseFloat(distanceVal) > 0;

    // Construct full StickerStats object with zero hardcoded assumptions
    const stats: StickerStats = {
        id: 999999,
        title: inputTitle.value,
        shortTitle: inputTitle.value.length > 22 ? inputTitle.value.slice(0, 22) + '…' : inputTitle.value,
        type: currentPresetState.type,
        hasMap: currentPresetState.hasMap && currentPresetState.polyline.length > 0,
        polyline: currentPresetState.polyline,
        avgHeartrate: inputHr.value ? parseInt(inputHr.value, 10) : null,
        maxHeartrate: inputHr.value ? parseInt(inputHr.value, 10) + 10 : null,
        startTime: currentPresetState.startTime || "07:00 AM",
        date: inputDate.value,
        dayName: currentPresetState.dayName || "Sunday",
        dayAndNumber: currentPresetState.dayAndNumber || "Sun 29",
        rawDate: new Date().toISOString(),
        avgTemp: currentPresetState.avgTemp || null,
        hasDistance,
        activityType: currentPresetState.type,
        calories: inputCalories.value || null,
        location: inputLocation.value,
        region: "CDMX",
        timeStr: inputDuration.value,
        mainValue: hasDistance ? inputDistance.value : inputDuration.value,
        distanceVal: hasDistance ? distanceVal : "0.00",
        mainLabel: hasDistance ? "Distance" : "Duration",
        subValue: inputPace.value,
        subLabel: inputPaceUnit.value,
        maxPace: currentPresetState.maxPace || "3:48",
        maxPaceLabel: "Max Pace",
        maxPaceUnit: currentPresetState.paceUnit === "km/h" ? "km/h" : "min/km",
        dataPoints: []
    };

    // Check compatibility and show warning banner if mismatched
    const comp = validateTemplateCompatibility(templateId, stats);
    let banner = document.getElementById('harness-warning-banner');
    if (!comp.compatible) {
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'harness-warning-banner';
            banner.style.cssText = 'background: rgba(239, 68, 68, 0.9); color: #fff; padding: 0.6rem 1rem; border-radius: 6px; font-size: 0.8rem; font-weight: 600; margin-bottom: 1rem; text-align: center;';
            canvasContainer.parentElement?.insertBefore(banner, canvasContainer);
        }
        banner.textContent = comp.warning || '';
        banner.style.display = 'block';
    } else if (banner) {
        banner.style.display = 'none';
    }

    // Draw using standard Scora CanvasPainter at 1:1 canvas pixel resolution
    await drawTemplate('harness-canvas', stats, templateId, textColor, showLogo, false);
}

// --- UPDATE VISUAL BACKGROUND ---
function updateBackground() {
    const bgType = selectBackground.value;
    groupCustomBg.style.display = bgType === 'custom' ? 'block' : 'none';

    // Reset styles
    canvasContainer.style.backgroundColor = '';
    canvasContainer.style.backgroundImage = '';

    if (bgType === 'solid-black') {
        canvasContainer.style.backgroundColor = '#000000';
    } else if (bgType === 'solid-slate') {
        canvasContainer.style.backgroundColor = '#334155';
    } else if (bgType === 'dark-grid') {
        // High fidelity sports editor grid background
        canvasContainer.style.backgroundColor = '#090d16';
        canvasContainer.style.backgroundImage = `
            linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)
        `;
        canvasContainer.style.backgroundSize = '20px 20px';
    } else if (bgType === 'demo-photo-1') {
        // Default preset sunset runner background
        canvasContainer.style.backgroundImage = `url('/assets/scora-hero-banner.png')`;
        canvasContainer.style.backgroundSize = 'cover';
        canvasContainer.style.backgroundPosition = 'center';
    }
}

// --- RUN AI RULE COMPLIANCE AUDIT ---
async function runAiAudit() {
    const templateId = selectTemplate.value;

    // UI Loading state
    auditStatus.className = 'audit-status-badge status-loading';
    auditStatus.textContent = 'Auditing...';
    auditResultsContainer.innerHTML = `
        <div style="text-align: center; color: var(--text-secondary);">
            🤖 Contactando con Gemini. Analizando código de "${templateId}"...
        </div>
    `;

    try {
        const res = await fetch(`/api/check-rules?templateId=${templateId}`);
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `HTTP ${res.status}: ${res.statusText}`);
        }

        const data = await res.json();

        // Update status badge
        if (data.compliant) {
            auditStatus.className = 'audit-status-badge status-passed';
            auditStatus.textContent = `PASS (${data.score}/100)`;

            auditResultsContainer.innerHTML = `
                <div style="color: #4ade80; font-weight: 700; margin-bottom: 0.5rem; text-align: center;">
                    ✓ ¡El template sigue todas las directrices de Scora!
                </div>
                <p style="color: var(--text-secondary); margin: 0; line-height: 1.4;">
                    El agente de IA no encontró violaciones de directrices de canvas en la función <code>${data.functionName}</code>.
                </p>
            `;
        } else {
            auditStatus.className = 'audit-status-badge status-failed';
            auditStatus.textContent = `FAIL (${data.score}/100)`;

            let violationsHtml = '';
            (data.violations || []).forEach((v: any) => {
                violationsHtml += `
                    <div class="audit-violation-item">
                        <span class="violation-severity severity-${v.severity || 'medium'}">${v.severity || 'Warning'}</span>
                        <div style="font-weight: 700; color: #fff; margin-bottom: 0.2rem;">${v.rule || 'Violation'}</div>
                        <div class="violation-details">${v.details || ''}</div>
                    </div>
                `;
            });

            auditResultsContainer.innerHTML = violationsHtml;
        }

    } catch (err: any) {
        auditStatus.className = 'audit-status-badge status-failed';
        auditStatus.textContent = 'ERROR';
        auditResultsContainer.innerHTML = `
            <div style="color: #f87171; font-weight: 600; text-align: center;">
                No se pudo realizar la auditoría
            </div>
            <p style="color: var(--text-secondary); margin: 0.5rem 0 0 0; font-size: 0.75rem; line-height: 1.4;">
                Asegúrate de que <code>GEMINI_API_KEY</code> esté configurada en tu archivo <code>.env.local</code> y estés ejecutando la app a través del servidor dev de Vercel (<code>vercel dev</code>).
                <br><br>
                Detalle del error: ${err.message}
            </p>
        `;
    }
}

// --- SETUP EVENT BINDINGS ---
function bindEvents() {
    // Dropdown change listeners
    selectTemplate.addEventListener('change', () => {
        triggerRender();
        // Reset audit panel state when switching templates
        auditStatus.className = 'audit-status-badge status-idle';
        auditStatus.textContent = 'Idle';
        auditResultsContainer.innerHTML = `
            <p style="color: var(--text-secondary); margin: 0; font-style: italic; text-align: center;">
                Haz clic en el botón para auditar este template contra las reglas de diseño y variables.
            </p>
        `;
    });

    selectPreset.addEventListener('change', () => {
        loadPreset(selectPreset.value);
        triggerRender();
    });

    selectTextColor.addEventListener('change', triggerRender);
    selectBackground.addEventListener('change', () => {
        updateBackground();
        triggerRender();
    });

    checkLogo.addEventListener('change', triggerRender);

    // Live text/input changes
    const inputs = [
        inputTitle, inputDistance, inputDuration, inputPace,
        inputPaceUnit, inputHr, inputCalories, inputLocation, inputDate
    ];
    inputs.forEach(el => {
        el.addEventListener('input', triggerRender);
    });

    // Custom background file handler
    inputBgFile.addEventListener('change', () => {
        const file = inputBgFile.files?.[0];
        if (file) {
            const url = URL.createObjectURL(file);
            canvasContainer.style.backgroundImage = `url('${url}')`;
            canvasContainer.style.backgroundSize = 'cover';
            canvasContainer.style.backgroundPosition = 'center';
            triggerRender();
        }
    });

    // Button actions
    btnExport.addEventListener('click', () => {
        exportCanvas('harness-canvas');
    });

    btnRunAudit.addEventListener('click', runAiAudit);
}

// --- ENTRY POINT ---
document.addEventListener('DOMContentLoaded', () => {
    // Setup initial state
    initDropdowns();
    updateBackground();

    // Canvas sizing setup - ensure exact 1080x1920 1:1 buffer rendering matching exportCanvas
    const canvas = document.getElementById('harness-canvas') as HTMLCanvasElement;
    if (canvas) {
        canvas.width = 1080;
        canvas.height = 1920;
    }

    bindEvents();
    triggerRender();
});

