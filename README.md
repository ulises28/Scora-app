<div align="center">
  <img src="./public/assets/scora-hero-banner.png" alt="Scora Sticker Showcase" width="100%" style="border-radius: 8px; margin-bottom: 24px;" />

  <h1>SCORA.</h1>
  <p><strong>The Bridge Between Performance and Storytelling.</strong></p>
  <p><i>Transform raw Strava activity data into premium, high-fidelity social stickers and story-ready aesthetic images.</i></p>

  <p>
    <a href="https://github.com/ulises28/Scora-app/actions">
      <img src="https://github.com/ulises28/Scora-app/actions/workflows/ci.yml/badge.svg" alt="CI Status">
    </a>
    <img src="https://img.shields.io/badge/Vite-7.3-646CFF?logo=vite" alt="Vite 7">
    <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript" alt="TypeScript 5">
    <img src="https://img.shields.io/badge/Node-24-339933?logo=node.js" alt="Node 24">
  </p>
</div>

---

## 📖 Overview

**Scora** is a sophisticated web application designed for athletes and creators who demand high-end visual representations of their performance. Beyond simple data visualization, Scora acts as a professional-grade rendering engine that converts **Strava API** polylines and metrics into customizable, high-resolution (1080x1920) assets ready for **Instagram Stories**, **TikTok**, and more.

> [!NOTE]
> Scora was engineered to solve the "Rigid Data" problem: bridging the gap between rugged athletic output and refined visual storytelling.

---

## 🛠 Engineering Highlights

Scora isn't just a frontend project; it's a showcase of modern full-stack engineering patterns, strict API concurrency, and complex problem-solving.

### 1. High-Precision Vector Rendering Engine
At the core of Scora is a custom-built **Canvas Rendering Engine** designed for micro-typography and pixel-perfect layouts.
- **Registry-Based Architecture**: Decoupled template rendering using a plugin pattern, allowing for dozens of unique "Sticker" designs (e.g., *Editorial Strip*, *Science Pro*, *Performance Bars*).
- **Micro-Typography Engine**: Custom implementations for letter-spacing, unit alignment, and transparent "Hero" number effects that exceed standard CSS capabilities.
- **Geospatial Processing**: Custom algorithms for decoding Google Polyline formats, calculating dynamic geospatial bounds, and rendering perfectly smoothed paths.

### 2. Concurrency Control: The Waiting Room
To manage the Strava API's strict "Single Connected Athlete" limitation without sacrificing user experience, Scora implements a robust **Queue System**.
- **Atomic Locking**: Uses **Upstash Redis** with atomic `SET NX` locks to ensure only one athlete's data is processed at a time per session slot.
- **Session Orchestration**: A polling-based waiting room that handles cross-session state using serverless edge functions.

### 3. Absolute Session Safety (Orphan-Proof)
To protect limits against sudden browser closures (e.g., Incognito Mode tab exits), Scora utilizes a **Dual-Layer Defense**:
- **Client-Side Beacons**: Uses `navigator.sendBeacon` hooked into browser lifecycle events (`visibilitychange`, `pagehide`) to guarantee deauthorization payloads fire even when the browser process is instantly killed.

### 4. Agentic Engineering & Autonomous QA Pipeline
Scora features a "Studio Grade" quality pipeline that functions as a self-healing ecosystem, rather than a passive test suite:
- **Architectural Tiering**: Tests are segmented into three distinct feedback layers:
    - **`@smoke`**: Critical path verification (Fast feedback in < 60s).
    - **`@regression`**: Exhaustive logic and fallback validation.
    - **`@visual`**: The "Absolute Truth" engine for pixel-perfect rendering.
- **Autonomous Self-Healing**: Utilizing the `stefanzweifel/git-auto-commit-action`, the pipeline automatically identifies missing or shifted Linux-based snapshots in Docker environments and commits them back to the branch—eliminating manual snapshot maintenance.
- **Diagnostic Surgeon**: A custom Monocart JSON parser (`ci-diagnostics.cjs`) identifies exact test failures and publishes a high-visibility summary directly to the GitHub Job Summary—no more hunting through log files.
- **Micro-Threshold Precision**: Visual tests are calibrated to a 1% sensitivity level, detecting even a 1px drift in typography or design elements.
- **Signal-Aware Testing**: Uses the `_scoraIsSettled` hook into `requestAnimationFrame` to eliminate all flakiness, ensuring snapshots are only taken when the rendering engine is perfectly stable.

---

## 🛠 Local Development

To run Scora locally for testing or development, you have two options:

### 1. Mock Mode (Zero Configuration)
If you run the app on `localhost` without a Strava API configuration, you will see a **"✨ Probar con Datos Demo"** button on the login screen. 
- This instantly populates your feed with high-quality activity samples.
- Perfect for quickly testing the UI Canvas engine or adding new templates.

### 2. Full Stack (Real API)
To test the real Strava integration and serverless functions locally:
1. Install the [Vercel CLI](https://vercel.com/download): `npm i -g vercel`
2. Run `vercel dev` instead of `npm run dev`.
3. Set your `VITE_STRAVA_CLIENT_ID` and `VITE_STRAVA_CLIENT_SECRET` in a `.env` file.
4. Ensure your **Authorization Callback Domain** in [Strava Settings](https://www.strava.com/settings/api) is set to `localhost`.

---

## 🚀 Technical Stack

- **Framework**: [Vite 7](https://vitejs.dev/) & [TypeScript 5](https://www.typescriptlang.org/)
- **Backend**: [Vercel Serverless Functions](https://vercel.com/docs/functions) (Node.js)
- **State/Cache**: [Upstash Redis](https://upstash.com/)
- **Graphics**: [HTML5 Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
- **Testing**: [Playwright](https://playwright.dev/) & [Vitest 4](https://vitest.dev/)

---

## ⚙️ Development

### Prerequisites
- Node.js 24+
- A [Strava Developer](https://developers.strava.com/) API Application

### Installation
```bash
git clone https://github.com/ulises28/Scora-app.git
cd Scora-app
npm install
npm run dev
```

### Verification & Infrastructure
```bash
# 🧪 TIER 1: Smoke Tests (Core Editor & Nav)
# Fast validation for Pull Requests (< 60s feedback).
npm run test:e2e -- --project="Smoke: Chromium"

# 🧪 TIER 2: Full Regression (Deep Logic)
# Exhaustive check of all 90+ rendering scenarios.
npm run test:e2e -- --project="Regression: Chromium"

# 🧪 TIER 3: Visual Absolute Truth (Snapshots)
# Verifies pixel-perfect rendering across Docker snapshots.
npm run test:e2e -- --project="Visual: Docker-Linux"

# 🤖 Scora QA Bot (Watchdog & Healer)
# Run IA-Agent visual audit and sync ephemeral design state.
npm run test:agent
npm run heal

# 📊 Diagnostics & Reports
# Generate a local Monocart dashboard of the latest run result.
npm run test:report

# ⚙️ Unit & Logic
# Validate core mathematical and polyline processing logic.
npm run test
```

---

---

## 🤝 Acknowledgments

Special thanks to the [AutoSkills](https://www.autoskills.sh/) team for the high-fidelity agentic framework that powers Scora's automated intelligence and QA systems.

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
