/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
    server: {
        host: true,
        port: 5500, // Change this to whatever port Strava expects!
        strictPort: true
    },
    build: {
        rollupOptions: {
            input: {
                main: 'index.html',
                support: 'support.html',
                harness: 'harness.html'
            }
        }
    }
});
