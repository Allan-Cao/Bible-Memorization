import { defineConfig, devices } from '@playwright/test';

// End-to-end smoke test against the static build. Run with `npm run test:e2e`.
export default defineConfig({
	testDir: 'tests/e2e',
	use: { baseURL: 'http://localhost:4173' },
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: {
		command: 'npm run build && npm run preview -- --port 4173 --strictPort',
		url: 'http://localhost:4173',
		reuseExistingServer: !process.env.CI,
		timeout: 120_000
	}
});
