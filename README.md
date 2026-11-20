# manna.cards

A website that makes [Anki](https://apps.ankiweb.net/) flash cards for memorizing Scripture. You type a list of passages, it builds a deck file (`.apkg`), and you import that into Anki. When you change the list later and import again, Anki updates the cards you already have and keeps your progress.

Everything runs in the browser. There is no server and no account, and decks are saved only in the browser that made them.

## The cards

- One card per verse. The front shows the reference and the verse before it, dimmed, as a lead-in. The back shows the verse.
- Each verse is asked once. A verse of more than about 30 words is split into two or three cards at its strongest punctuation, and you can move the breaks in the editor.
- Poetry keeps its lines and indents. Psalm titles are shown above the first verse and are not asked. Selah is shown but is not part of the hint.
- A first-letter hint is behind a "Hint" link on the front.
- Cards use Anki's own font, colours and night mode.

## Using it

1. Create a deck, choose a translation and type the passages, one per line: `Psalm 23`, `John 3:16-18`, `John 14:1-3, 6`. A line starting with `#` is a heading. Mistakes are reported with their line number.
2. Check the cards in the preview. "Adjust breaks" on a verse lets you choose where it is split.
3. "Export for Anki" downloads the deck. Open the file with Anki; the import options Anki suggests are right.

To update a deck, change the list and export again. The export window says what was added and removed. Anki never deletes cards when importing, so when passages were removed the window also gives a search to paste into Anki's browser that finds the old cards.

Two things to know about Anki:

- Anki finds a deck by its name. If you rename a deck here, rename it in Anki too before importing, otherwise new cards go to a second deck.
- Anki keeps the order of cards it already has, so new cards from a passage added in the middle of the list can come up out of list order.

"Share" gives a link (or a file) that holds the deck's list. Whoever opens it gets their own copy, and can update it from a newer link later.

## Translations

Berean Standard Bible (BSB), World English Bible (WEB) and King James Version (KJV), all public domain (the KJV outside the United Kingdom) and taken from [eBible.org](https://ebible.org/). The text is converted from USFM into `static/text/` and committed, so the site needs no other service.

## Development

Requires Node 22.17 or newer.

```bash
npm install
npm run dev        # dev server
npm test           # unit tests (Vitest, single run)
npm run test:e2e   # browser tests (Playwright) against the static build
npm run check      # type check
npm run lint       # prettier + eslint
npm run build      # static site into build/
npm run build:text # download the USFM sources and regenerate static/text/
```

The browser tests need `npx playwright install chromium firefox` once. `BASE_URL=https://example.org npm run test:e2e` runs them against a site that is already running.

Layout:

- `src/lib/core/`: the logic, in plain TypeScript with no framework imports: reference parsing, verse splitting, card and `.apkg` generation. Tests sit beside the code.
- `src/lib/ui/`, `src/routes/`: the SvelteKit pages and components (Svelte 5, Tailwind, Bits UI).
- `static/text/`: the Bible text, one JSON file per book and translation.
- `presets/`: the example lists offered on the home page.
- `tests/golden/`: text and cards for a set of passages, written out for a person to read. They are checked by `npm test`; after an intended change, update them with `npx vitest run -u`.

`scripts/anki-import-check.py` imports generated decks into Anki's own importer and checks that an update keeps scheduling. Run it after changing anything under `src/lib/core/anki/`:

```bash
uv run --with anki python scripts/anki-import-check.py
```

The note type id and its field list (`Reference, Context, Answer, Hint, Info`) must never change, or existing decks stop updating in place. A change to the card template or CSS needs a `TEMPLATE_VERSION` bump in `src/lib/core/anki/notetype.ts`.

## Deploying

The site is static files. `wrangler.toml` serves `build/` from Cloudflare Workers as static assets, with no Worker script. Both commands build first:

```bash
npm run deploy:preview  # bible-memorization.allancao.workers.dev
npm run deploy          # manna.cards (production)
```

Any static host works if it serves `404.html` for unknown paths and `/deck/*` (see `static/_redirects`).

## License

MIT for the code (see `LICENSE`). The Bible translations are public domain as described above; "World English Bible" is a trademark of eBible.org.
