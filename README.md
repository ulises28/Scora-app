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

**Scora** is a professional-grade rendering engine that converts **Strava API** polylines and metrics into customizable, high-resolution (1080x1920) assets ready for **Instagram Stories**, **TikTok**, and more. It is built on a **Bimodal Architectural Pattern**, optimizing for both rapid developer feedback and exhaustive production-grade verification.

---

## 🤖 The Scora Integrity Engine (Auto-healing)

Scora uses a **Triple-Lock Synchronization** pattern to ensure that the UI, the documentation, and the E2E tests never drift:

1.  **The Registry (`StickerRegistry.ts`)**: The single source of truth for all sticker capabilities (features, categories, renderers).
2.  **The Sync Script (`sticker-sync.ts`)**: Automatically translates the Registry into a machine-readable `sticker-capabilities.json`.
3.  **The Predictor (`editor.spec.ts`)**: E2E tests use the JSON to dynamically predict which stickers should be visible for any given activity (Run, Bike, or Workout).

This architecture enables **Auto-healing**: When you add a new sticker to the Registry and run `npm run sync:stickers`, the E2E suite automatically verifies the new sticker without any manual test code changes.

---

## 🛠 Engineering Highlights

### 1. Bimodal Execution Environment (Vite ↔️ Vercel)
The project utilizes a dynamic `webServer` configuration in Playwright to balance speed and accuracy:
- **UI-Core (Fast Tier)**: Runs against a native **Vite** server (`npm run dev`). Since Vite doesn't serve serverless functions, all API calls are automatically mocked. This provides sub-second feedback for UI/Visual changes.
- **Regression-API (Deep Tier)**: Runs against a **Vercel Dev** server (`vercel dev`). This environment executes the actual Node.js Serverless Functions in the `api/` directory, hitting a real **Upstash Redis** instance for queue and session logic.

### 2. High-Precision Vector Rendering Engine
- **Registry-Based Architecture**: Decoupled template rendering using a plugin pattern.
- **Micro-Typography Engine**: Custom implementations for letter-spacing, unit alignment, and transparent "Hero" number effects.
- **Geospatial Processing**: Custom algorithms for decoding Google Polyline formats and rendering smoothed paths.

### 3. Concurrency & Safety (Redis NX + Beacons)
- **Atomic Locking**: Uses Upstash Redis with `SET NX` locks to manage Strava's "Single Connected Athlete" limit.
- **Client-Side Beacons**: Uses `navigator.sendBeacon` hooked into browser lifecycle events (`visibilitychange`, `pagehide`) to guarantee deauthorization even when the browser is instantly killed.
- **Graceful Handover**: A polling-based waiting room system (`/api/queue-status`) manages user progression.

---

## 🤖 Advanced Testing Infrastructure

### 1. Token-Efficiency Strategy (Resource Optimization)
To minimize CI resource consumption and LLM token usage:
- **Day-to-day (CI/CD)**: Executes only `@smoke` and `@visual` tests against the lightweight Vite server.
- **Midnight Regression**: A scheduled job runs the exhaustive `@regression` suite against the heavy Vercel environment.

### 2. The Integrity Engine (Sticker Registry Sync)
To prevent drift between code and documentation:
- **`sticker-sync.ts`**: Automatically audits the `StickerRegistry` and generates `sticker-capabilities.json`.
- **Capability Pinning**: E2E tests use this JSON to dynamically generate a test matrix for all registered stickers.

### 3. Intelligent Failure Diagnostics (`ci-diagnostics.cjs`)
A custom post-test analyzer that groups failures by project, cleans ANSI codes, and injects **Quick Debug Stacks** directly into the GitHub Job Summary.

---

## 🛠 Local Development

### 1. Mock Mode (Zero Configuration)
If you run the app on `localhost` without a Strava API configuration, use the **"✨ Probar con Datos Demo"** button on the login screen.
- Perfect for quickly testing the UI Canvas engine or adding new templates.
- **Run**: `npm run dev`

### 2. Full Stack (Real API)
To test real Strava integration and serverless functions:
1. Install [Vercel CLI](https://vercel.com/download): `npm i -g vercel`
2. **Run**: `vercel dev`
3. Requires `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in `.env.local`.

---

## ⚙️ Testing Command Reference

### 🧪 Tier 1: UI & Visual (Vite-Powered)
```bash
# Run all UI tests (Mocked APIs, sub-60s)
npx playwright test --project="UI-Core"

# Run specific UI test
npx playwright test tests/e2e/ui/editor.spec.ts --project="UI-Core"

# Run Visual tests in Docker (Absolute Truth)
npm run test:sync-linux
```

### 🧪 Tier 2: Backend & Integration (Vercel-Powered)
```bash
# Run backend verification integration tests
E2E_SERVER=vercel npx playwright test tests/e2e/api/backend-verification.spec.ts --project="Regression-API"

# Run full regression suite against real API
E2E_SERVER=vercel npx playwright test --project="Regression-API"
```

### 🧪 Tier 3: Unit & Diagnostics
```bash
# Run mathematical and polyline unit tests
npm run test

# Manually trigger the CI Diagnostic reporter (requires report.json)
node scripts/ci-diagnostics.cjs

# Sync the Sticker Registry with test fixtures
npm run sync:stickers
```

---

## 🚀 Technical Stack

- **Framework**: [Vite 7](https://vitejs.dev/) & [TypeScript 5](https://www.typescriptlang.org/)
- **Backend**: [Vercel Serverless Functions](https://vercel.com/docs/functions) (Node.js)
- **State/Cache**: [Upstash Redis](https://upstash.com/)
- **Graphics**: [HTML5 Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
- **Testing**: [Playwright](https://playwright.dev/) & [Vitest 4](https://vitest.dev/)

---

## 🤝 Acknowledgments

Special thanks to the [AutoSkills](https://www.autoskills.sh/) team for the agentic framework that powers Scora's automated intelligence and QA systems.

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
