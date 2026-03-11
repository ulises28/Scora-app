<div align="center">
  <h1>Scora - Designed to be seen.</h1>
  <p>Transform your Strava activities into aesthetic stickers and premium images ready to be shared on Instagram Stories, TikTok, and more.</p>
</div>

---

## 🚀 Overview

**Scora** is a high-performance web application designed to help athletes and creators effortlessly convert their Strava activities into highly customizable visual content. By integrating directly with the Strava API, Scora fetches your latest activities and visually renders them using the HTML Canvas API—providing premium, responsive templates that highlight your distance, max pace, and map routes.

## 🌟 Key Features

- **Automated Strava Integration**: Instantly imports your latest workouts and activities through the Strava API.
- **Dynamic & Customizable Rendering**: Generates high-quality cards and stickers using predefined visual templates (Minimal, Route, Data, Direct Message (DM), and Stats).
- **Responsive & Premium Design**: Mobile-first UI optimized for seamless usage across devices, delivering a smooth user experience.
- **High-Fidelity Exports**: One-click downloads directly to your device, maintaining crisp resolution.

## 🛠 Tech Stack

- **Frontend Core**: Vite, TypeScript, Vanilla CSS, HTML5.
- **Graphics Engine**: HTML Canvas API.
- **Geospatial Processing**: Custom Polio algorithms for accurate Strava map polyline decoding.
- **Static Typing**: Full TypeScript coverage for a robust and maintainable codebase.

## 🧪 Enterprise-Level Test Architecture

Quality and reliability are at the core of Scora. The project features a professional, domain-driven testing architecture designed for scalability and modern CI/CD integration, acting as a strong showcase of engineering best practices.

### End-to-End (E2E) Testing with Playwright
- **Domain-Driven Design**: The test suite employs a robust 3-layered architecture:
  - **Page Object Model (POM)**: Ensures test maintainability and separates UI structure from testing logic. We enforce strict standards (e.g., no XPath/CSS indices, centralized constructor locators, and user-centric `getByRole` selectors).
  - **API Client & Interceptors**: Dedicated API interception modules to mock and control Strava API responses seamlessly without hitting rate limits.
  - **Fixtures & Utilities**: Reusable fixtures to speed up assertions, maintain isolated test states, and reduce code duplication.
- **Continuous Integration (CI)**: Automated GitHub Actions workflows (`playwright.yml`, `ci.yml`) run formatting, linting, and full E2E suites on every pull request.

## ☁️ Deployment Architecture

Scora is securely deployed on **Vercel**, leveraging enterprise-grade edge architecture:
- **Serverless Functions**: Strava's OAuth client secrets are securely handled server-side via `/api/strava-token` and `/api/strava-refresh`, entirely abstracting credentials from the frontend.
- **Queue System**: Built-in Vercel edge rate-limit handling and a UI queue to protect against Strava API limits.
- **CI/CD Integrations**: Vercel automatically creates preview branches for PRs and deploys production builds securely upon merging to `main`.

### Unit Testing with Vitest
- **Fast & Reliable**: Leverages Vitest for lightning-fast unit and integration verification.
- **Code Coverage**: Integrated coverage reporting powered by `@vitest/coverage-v8` to track project health and test completeness.

## ⚙️ Getting Started

### Prerequisites
Since this app relies on the [Strava API](https://developers.strava.com/), you will need to create an API Application in your Strava profile to obtain the necessary credentials.

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/ulises28/Scora-app.git
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```

### Running Tests
- **E2E Tests**: Run `npm run test:e2e` to trigger the Playwright suite.
- **Unit Tests**: Run `npm run test` to execute Vitest.

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
