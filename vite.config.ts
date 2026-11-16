import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// 404.html is the app shell: hosts serve it for unknown paths, and static/_redirects
			// serves it with status 200 for the client-only deck pages.
			adapter: adapter({ fallback: '404.html' })
		})
	],
	test: {
		environment: 'node',
		include: ['src/lib/core/**/*.test.ts', 'scripts/**/*.test.ts'],
		expect: { requireAssertions: true }
	}
});
