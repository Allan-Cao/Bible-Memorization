# CLAUDE.md

Bible Memorization is a static web app that builds Anki decks (`.apkg`) for memorizing Scripture. Each card asks for one verse (long verses are split into parts), with the previous verse shown as a lead-in. All logic runs in the browser. There are no server routes.

Scripts in `scripts/` run with `npx tsx scripts/<name>.ts`.

## SvelteKit 3 differences from Kit 2 (confirmed in this scaffold)

- No `svelte.config.js`. Kit options are passed to `sveltekit({...})` in `vite.config.ts`; the adapter is set there (`adapter: adapter({ fallback: '404.html' })`).
- `$lib` is replaced by `#lib`, a Node subpath import declared in `package.json` `"imports"` (`#lib` and `#lib/*`). Include file extensions: `#lib/foo.js`.
- tsconfig extends `$app/tsconfig` instead of `./.svelte-kit/tsconfig.json`, with explicit `include` and `"types": ["$app/types", "node"]`.
- Layout and page props types are imported from `./$types` (`LayoutProps`).
- Vitest config lives in `vite.config.ts` (`test` key). Node >=22.17, TypeScript 6, Vite 8.
- Other removals in the migration guide (not used here yet): `$app/stores` (use `$app/state`), `$app/environment` (now `$app/env`), `$env/*` (deprecated for `$app/env/private` and `$app/env/public`).

## Static output

adapter-static builds into `build/` with the app shell as `404.html`. Client-only routes (`/deck/[id]`) are served from it: `static/_redirects` rewrites `/deck/*` to it with status 200, and any other unknown path gets it with status 404.

Hosting is Cloudflare Workers static assets (`wrangler.toml`, no Worker script, so it costs nothing). `static/_headers` caches the hashed files under `/_app/immutable/`. `npm run deploy` ships prod (the `manna-cards` Worker on manna.cards); `npm run deploy:preview` ships the top-level `bible-memorization` Worker on workers.dev.

## Conventions

- Core is framework-free and uses relative imports only. ESLint forbids `svelte`, `svelte/*`, `@sveltejs/*`, `$app/*` and `#lib` imports under `src/lib/core/`.
- Write tests first (TDD) for all core logic. Tests live beside the code as `*.test.ts` in `src/lib/core/` and `scripts/`, run in plain Node.
- UI is built from Bits UI primitives styled with Tailwind utility classes. No hand-written CSS (the only stylesheet is `@import 'tailwindcss';`).
- Conventional Commits, committed often.
- No backward-compatibility obligations to the old Python tool.
