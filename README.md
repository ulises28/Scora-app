<div align="center">
  <h1>SCORA.</h1>
  <p><strong>The Bridge Between Performance and Storytelling.</strong></p>
  <p><i>Transform raw Strava activity data into premium, high-fidelity social stickers and story-ready aesthetic images.</i></p>

  <p>
    <a href="https://github.com/ulises28/Scora-app/actions">
      <img src="https://github.com/ulises28/Scora-app/actions/workflows/ci.yml/badge.svg" alt="CI Status">
    </a>
    <img src="https://img.shields.io/badge/Vite-8.0-646CFF?logo=vite" alt="Vite 8">
    <img src="https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript" alt="TypeScript 6">
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

Scora isn't just a frontend project; it's a showcase of modern full-stack engineering patterns and complex problem-solving.

### 1. High-Precision Vector Rendering Engine
At the core of Scora is a custom-built **Canvas Rendering Engine** designed for micro-typography and pixel-perfect layouts.
- **Registry-Based Architecture**: Decoupled template rendering using a plugin pattern, allowing for dozens of unique "Sticker" designs (e.g., *Performance Bars*, *Modern Pill*, *Workout Receipt*).
- **Micro-Typography Engine**: Custom implementations for letter-spacing, unit alignment, and transparent "Hero" number effects that exceed standard CSS capabilities.
- **Geospatial Processing**: Custom algorithms for decoding Google Polyline formats, calculating dynamic geospatial bounds, and rendering smoothed paths with aesthetic glow effects.

### 2. Concurrency Control: The Waiting Room
To manage the Strava API's "Single Connected Athlete" limitation, Scora implements a robust **Concurrency Queue System**.
- **Atomic Locking**: Uses **Upstash Redis** with atomic `SET NX` locks to ensure only one athlete's data is processed at a time per session slot.
- **Session Orchestration**: A polling-based waiting room that handles cross-session state using serverless edge functions.
- **Fault-Tolerance**: Built-in fallback mechanisms to ensure graceful degradation if the orchestration layer encounters downtime.

### 3. Professional Quality Engineering (QA)
The repository serves as a masterclass in modern testing architectures:
- **Domain-Driven E2E**: Built with **Playwright** using a strict **Page Object Model (POM)** and custom **Fixtures**.
- **Visual Regressions**: Automated snapshot testing to ensure rendering consistency across different browser engines (Chromium, Firefox, WebKit) and environments.
- **CI/CD Pipeline**: A fully modernized pipeline running on **Node 24** and **GitHub Actions**, performing linting, unit testing (Vitest), and E2E validation on every push.

---

## 🚀 Technical Stack

- **Framework**: [Vite 8](https://vitejs.dev/) & [TypeScript 6](https://www.typescriptlang.org/)
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

### Verification
```bash
# Run unit tests with Vitest
npm run test

# Run E2E tests with Playwright
npm run test:e2e

# Run production build
npm run build
```

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
