# Scora Mobile: App Store & Google Play Store Migration Plan

This document outlines the technical requirements, architectural changes, and store guidelines necessary to package Scora as a native mobile application for the Apple App Store and Google Play Store and monetize it successfully.

---

## 1. Hybrid App Shell: Capacitor by Ionic
To wrap the current Vite/React/TypeScript web application into native iOS and Android projects, we recommend using **Ionic Capacitor**. 

### Setup Steps
1. Install Capacitor Core and CLI:
   ```bash
   pnpm add @capacitor/core
   pnpm add -D @capacitor/cli
   ```
2. Initialize Capacitor:
   ```bash
   npx cap init Scora com.scora.app --web-dir=dist
   ```
3. Add native platforms:
   ```bash
   pnpm add @capacitor/ios @capacitor/android
   npx cap add ios
   npx cap add android
   ```
4. Build the web app and sync it to the native projects:
   ```bash
   pnpm run build
   npx cap sync
   ```

---

## 2. Handling Strava OAuth in Native Apps
OAuth redirects in native applications differ from standard web pages because a web browser redirect to `https://scora-app.vercel.app/` will keep the user in the system browser rather than returning them to the native app.

### The Architecture: Deep Linking
To bridge this, we must implement custom deep links:

```
[Native App] 
   └── Opens System Web Browser (OAuth page)
         └── User Authorizes
               └── Redirects to Vercel bridge landing page
                     └── Redirects to Custom Scheme: scora://oauth?code=xxx
                           └── System opens Native App & passes the code
```

### Technical Requirements
1. **Custom URL Scheme**: Register `scora://` custom scheme in iOS (`Info.plist`) and Android (`AndroidManifest.xml`).
2. **Universal/App Links**: Set up associated domains using Apple App Site Association (`apple-app-site-association` file) and Android Asset Links (`assetlinks.json`) hosted on Vercel under `.well-known/`.
3. **Capacitor App Plugin**: Use the `@capacitor/app` plugin to listen for deep link events within the app lifecycle in `src/app.ts`:
   ```typescript
   import { App, URLOpenListenerEvent } from '@capacitor/app';

   App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
       const url = new URL(event.url);
       if (url.host === 'oauth') {
           const code = url.searchParams.get('code');
           const state = url.searchParams.get('state');
           // Dispatch event or call exchangeToken directly
       }
   });
   ```

---

## 3. Monetization: In-App Purchases (IAP)
To monetize the app in the stores (e.g., charging for premium templates, custom colors, or unlimited sticker generation), **you must use the native App Store and Google Play billing systems**.
- **Rule**: Apple and Google strictly prohibit third-party payment options (like Stripe or PayPal) for digital goods/subscriptions inside native apps.
- **Solution**: Use **RevenueCat** with the `@capacitor-community/purchases` plugin to easily manage in-app subscriptions and unlock premium features across both platforms without maintaining custom receipt-validation servers.

---

## 4. App Store Guidelines & Requirements Checklist

To avoid store rejection, Scora must adhere to these policies:

### A. Apple App Store
1. **Sign In with Apple**: If the app introduces general user accounts or social logins (e.g. Google), Apple requires offering "Sign in with Apple".
2. **Account Deletion**: If users create accounts, the app **must** offer a clear, easy way to delete the account and all associated data directly from the settings menu.
3. **Paid Content Gating**: Ensure that any premium feature is unlocked using native StoreKit (using the RevenueCat plugin).
4. **App Privacy Details**: You must provide a privacy policy URL and specify the data collected (e.g., Strava read permissions are categorized as "health and fitness" or "user content").

### B. Google Play Store
1. **Data Safety Form**: Declare exactly how you collect, share, and secure user data (specifically explaining that Strava tokens are deauthorized immediately after the fetch).
2. **Subscription Management**: Subscriptions must link to Google Play's subscription cancellation page.

---

## 5. Next Actions for Development
- [ ] Add `@capacitor/core` and `@capacitor/cli` to the project.
- [ ] Configure `capacitor.config.ts` to output to the `dist` directory.
- [ ] Create a lightweight Vercel bridge endpoint `/api/mobile-redirect` that takes the OAuth code and redirects the browser to `scora://oauth?code=xxx`.
- [ ] Install the `@capacitor/app` plugin and update [app.ts](file:///Users/ulises/Developer/Scora-app/src/app.ts) to handle deep links.
