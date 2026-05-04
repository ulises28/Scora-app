/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        globals: true,
        include: ['**/*.test.ts'],
        exclude: ['**/node_modules/**', '**/dist/**', '**/tests/e2e/**'],
        setupFiles: ['./tests/setup-unit.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: [
                '**/node_modules/**',
                '**/dist/**',
                '**/*.test.ts',
                'tests/setup-unit.ts',
                'tests/e2e/fixtures/**',
                'src/config.ts'
            ]
        }
    },
});
