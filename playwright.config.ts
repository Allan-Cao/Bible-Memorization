import { defineConfig, devices } from '@playwright/test';

// End-to-end tests against the static build. Run with `npm run test:e2e`
// (once: `npx playwright install chromium firefox`). `WEBKIT=1 npm run test:e2e` adds WebKit.
// `BASE_URL=https://... npm run test:e2e` tests a site that is already running, such as the
// deployed one or `npx wrangler dev`, instead of building and previewing here.
const local = 'http://localhost:4173';

export default defineConfig({
	testDir: 'tests/e2e',
	use: { baseURL: process.env.BASE_URL ?? local },
	projects: [
		{ name: 'chromium', use: { ...devices['Desktop Chrome'] } },
		{ name: 'firefox', use: { ...devices['Desktop Firefox'] } },
		// WebKit needs system libraries (`sudo npx playwright install-deps webkit`), so it is opt-in.
		...(process.env.WEBKIT ? [{ name: 'webkit', use: { ...devices['Desktop Safari'] } }] : [])
	],
	webServer: process.env.BASE_URL
		? undefined
		: {
				command: 'npm run build && npm run preview -- --port 4173 --strictPort',
				url: local,
				reuseExistingServer: !process.env.CI,
				timeout: 120_000
			}
});
