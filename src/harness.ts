import { ACTIVE_STICKER_LIST, ARCHIVED_STICKER_LIST } from './features/editor/StickerRegistry';
import { drawTemplate, exportCanvas } from './features/editor/CanvasPainter';

// --- ACTIVITY PRESETS ---
const PRESETS: Record<string, any> = {
    lululemon: {
        title: "Lululemon 10k",
        distance: "10.05 km",
        duration: "41:46",
        pace: "4:09",
        paceUnit: "/km",
        hr: "167",
        calories: "1068",
        location: "Cuauhtémoc",
        date: "March 29, 2026"
    },
    carrera_mañana: {
        title: "Carrera por la mañana",
        distance: "10.40 km",
        duration: "59:14",
        pace: "5:41",
        paceUnit: "/km",
        hr: "123",
        calories: "1075",
        location: "Roma Norte, CDMX",
        date: "April 22, 2026"
    },
    vuelta_ciclista: {
        title: "Vuelta ciclista matutina",
        distance: "5.00 km",
        duration: "31:01",
        pace: "9.7",
        paceUnit: "km/h",
        hr: "97",
        calories: "230",
        location: "Cuauhtémoc",
        date: "March 24, 2026"
    },
    pesas: {
        title: "Entrenamiento con pesas",
        distance: "0.00 km",
        duration: "1h 11m",
        pace: "122",
        paceUnit: "bpm",
        hr: "122",
        calories: "450",
        location: "SECRET LOCATION",
        date: "March 2, 2026"
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

// --- INITIALIZE DROPDOWNS ---
function initDropdowns() {
    // Populate templates dropdown
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

    // Populate default preset values
    loadPreset('lululemon');
}

// --- LOAD PRESET DATA ---
function loadPreset(presetKey: string) {
    const preset = PRESETS[presetKey];
    if (!preset) return;

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

// --- RENDER DRAW LOOP ---
async function triggerRender() {
    const templateId = selectTemplate.value;
    const textColor = selectTextColor.value;
    const showLogo = checkLogo.checked;

    // Split numeric values from units
    const rawDist = inputDistance.value;
    const distanceVal = rawDist.replace(/[^\d.]/g, '');
    const hasDistance = parseFloat(distanceVal) > 0;

    // Construct StickerStats object matching strava.ts structure
    const stats = {
        title: inputTitle.value,
        shortTitle: inputTitle.value.length > 22 ? inputTitle.value.slice(0, 22) + '…' : inputTitle.value,
        type: selectPreset.value === 'pesas' ? 'WeightTraining' : (selectPreset.value === 'vuelta_ciclista' ? 'Ride' : 'Run'),
        hasMap: selectPreset.value !== 'pesas',
        polyline: selectPreset.value === 'pesas' ? '' : 'yhpuBrtl|QZWr@[NKRIP]@MEEg@Ko@Ck@GkAIkJ{@a@BmGg@OCKEKU?_@F]TeDj@wFPeCP{Al@aHvAwQNkAViEz@yIb@aGRmBLkBR{Dd@qFBmAG}@Kq@eByEs@eBWaA[w@Qk@{@oBOs@MeAEOa@g@m@eAmDuJUc@[u@c@yAMMC@?FF\\v@dB~CvId@hALd@VfBJP\\`@T`@jAdDdAfCRr@dAnCt@fBHZFd@J|@?`@q@pHIh@KnAQrAIbAEjAKj@Y`DKTMFWB}CWe@?i@DsARuBp@wAp@_Az@g@j@u@jAYt@Qx@ObB@pBD|@Ht@f@lDP~@`@pAdBfFvAnI`@lBh@bBN`@^n@NPPLL@DAHKDKZqEBMBADF?L]fFo@hGAZi@pGE|@S`BYdES~ACp@[bDYjE_@rDG`AQ`BEbASbBKbAIRKF_@@u@NiAf@UR}@pASl@Gj@AjBSxB@JDHpAL`@PBA?WPqAR_AN]bA_BZo@Jo@TyBLIzAAp@MNOh@qALQb@_@HSB_@ES]iAKQKK_@UiA_@GOAe@Bg@ZgDDw@J_Af@kHLcADu@XyC^eFFWLKNG^@rCXrARxBTvAHz@@p@CdBLtCHJL?HCFCDo@X_@^',
        avgHeartrate: parseInt(inputHr.value) || null,
        maxHeartrate: (parseInt(inputHr.value) ? parseInt(inputHr.value) + 10 : null),
        startTime: "12:04 PM",
        date: inputDate.value,
        dayName: "Sunday",
        dayAndNumber: "Sun 29",
        rawDate: new Date().toISOString(),
        avgTemp: "17",
        hasDistance,
        activityType: selectPreset.value === 'pesas' ? 'WeightTraining' : (selectPreset.value === 'vuelta_ciclista' ? 'Ride' : 'Run'),
        calories: inputCalories.value || null,
        location: inputLocation.value,
        region: "CDMX",
        timeStr: inputDuration.value,
        mainValue: hasDistance ? inputDistance.value : inputDuration.value,
        distanceVal,
        mainLabel: hasDistance ? "Distance" : "Duration",
        subValue: inputPace.value,
        subLabel: inputPaceUnit.value,
        maxPace: "3:48",
        maxPaceLabel: "Max Pace",
        maxPaceUnit: "min/km"
    };

    // Draw using standard Scora CanvasPainter
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
            const errData = await res.json();
            throw new Error(errData.error || 'Server returned an error');
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
            data.violations.forEach((v: any) => {
                violationsHtml += `
                    <div class="audit-violation-item">
                        <span class="violation-severity severity-${v.severity}">${v.severity}</span>
                        <div style="font-weight: 700; color: #fff; margin-bottom: 0.2rem;">${v.rule}</div>
                        <div class="violation-details">${v.details}</div>
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
    
    // Canvas sizing setup
    const canvas = document.getElementById('harness-canvas') as HTMLCanvasElement;
    canvas.width = 1080;
    canvas.height = 1920;

    bindEvents();
    triggerRender();
});
