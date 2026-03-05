/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
    base: '/Scora-app/',
    server: {
        host: true,
        port: 5500, // Change this to whatever port Strava expects!
        strictPort: true
    },
    test: {
        environment: 'jsdom', // Optional: 'happy-dom' or 'jsdom' if you test components
        globals: true,
    },
});
