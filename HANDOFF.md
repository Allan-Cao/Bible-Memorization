# Handoff note (2026-11-15)

Temporary file for whoever continues the TypeScript rewrite. Delete it when the rewrite is merged.

The approved plan is at `/home/allan/.claude/plans/could-you-review-the-async-tome.md`. `CLAUDE.md` describes the stack, commands and conventions; `README.md` describes the app. Work is on branch `ts-rewrite`; nothing is pushed.

## Owner's standing instructions

- TDD for core logic: see the test fail before implementing.
- UI is Bits UI primitives plus Tailwind utilities. No hand-written CSS.
- Conventional Commits, committed often, by sub-agents too.
- Small, human-readable modules. No speculative features.
- No backward compatibility with the old Python tool (deleted).
- ESV is out until Allan hears back from Crossway. The site is fully static.
- Delegate generously to sub-agents (Sonnet routine, Opus careful) to save the main context.

## State

Everything in the plan except ESV (phase 6) and the deploy itself is built and committed. On the final tree: `check` 0 errors, `lint` clean, 545 unit tests, 8 end-to-end tests (4 tests in Chromium and Firefox), `build`, and `scripts/anki-import-check.py` 59 checks against Anki 26.09.4.

## Only Allan can do these

1. **Deploy.** `npm run build && npx wrangler deploy` (it asks to log in to Cloudflare the first time). `wrangler.jsonc` is static assets only, with no Worker script, so it stays on the free plan. The worker is named `bible-memorization`; change `name` there for a different address. Afterwards `BASE_URL=https://<the address> npm run test:e2e` runs the browser tests against the live site.
2. **Try a deck on a phone.** Export a deck, import it into AnkiDroid or AnkiMobile, tap the hint, then import an updated export. Desktop behaviour is verified through Anki's own importer (below); the phone apps are not.
3. **Look at the card in Anki itself.** The card HTML and CSS are verified, but nobody has looked at a rendered card. In particular psalm titles and Selah are now small and italic (see "Decisions made" below).
4. **Safari.** The end-to-end tests pass in Chromium and Firefox. WebKit could not run on this machine without `sudo npx playwright install-deps webkit`; after that, `WEBKIT=1 npm run test:e2e`. Or just try the site in Safari.
5. **Screen reader.** An axe scan of every screen is clean in light and dark mode, and the keyboard paths are tested, but nobody has listened to it.
6. **Merge `ts-rewrite`** into `main` and push, then delete this file.
7. **Crossway** (ESV), still waiting on their reply.

## Review of the UI (done 2026-11-15)

All UI code was read and every screen was looked at in light, dark and phone width. The numbered review points from the previous note:

| #   | Point                                               | Outcome                                                                                                                     |
| --- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 1   | `previewDeck` repeated the walk in `makeNotes`      | `planCards` in `cards.ts` decides every card once; `makeNotes` and `previewDeck` are both made from it                      |
| 2   | `hintLines` took `firstLetters` HTML apart          | `render.ts` exports `hintText` (one line) and `hintLines`                                                                   |
| 3   | Every word gap in the break editor was a tab stop   | The gaps are a Bits UI toggle group: one tab stop, arrow keys move between gaps                                             |
| 4   | Open passages were tracked by position              | Each panel keeps its own state; a passage added on its own starts open                                                      |
| 5   | Example headings repeated the deck name; favicon    | Headings removed from `presets/*.txt`; favicon is an open book                                                              |
| 6   | UI commits not verified one by one                  | Not redone. Every commit since then was made on a passing tree                                                              |
| 7   | Real Anki, Firefox/Safari, clipboard, screen reader | Real Anki (desktop importer), Firefox and clipboard verified; Safari, phones and a real screen reader are in the list above |

Also found and fixed: the home page's form submitted natively if clicked before the page was running; renaming a deck rebuilt all cards; headings skipped a level in the editor; verse numbers had too little contrast in dark mode; the share link box could not be reached by keyboard.

## Decisions made while Allan was away (say if you disagree)

- **Psalm titles and Selah are small and italic on the card**, as the editor preview already showed them (`.title`, `.selah`; `TEMPLATE_VERSION` is now 2). This closes the "long psalm titles have no distinct styling" loose end. To undo: revert commit "feat: style psalm titles and Selah on the card".
- **The app shell is `404.html`, not `200.html`.** Cloudflare serves it for unknown paths (status 404, the app shows "Not Found") and `static/_redirects` rewrites `/deck/*` to it with status 200. Checked with `npx wrangler dev`.
- **The golden cards were read and the design confirmed** against the plan's decisions: one verse per card, lead-in from the previous unit within a range only, verse numbers as markers, each unit asked once, title instead of lead-in on a psalm's first verse, Selah never in the hint or lead-in, no lead-in across an omitted verse. Nothing needed changing. `tests/golden/cards/` is worth ten minutes of Allan's own reading before the merge, since it is his deck.

## Real Anki check of an exported deck

Besides `scripts/anki-import-check.py`, the Old Testament example was exported from the built site in a browser and imported into Anki 26.09.4's importer: 65 notes in list order; one card studied; then an updated export (two passages removed, one added, one inserted at the top) imported with 9 new and 54 updated notes, the studied card's interval kept, and the cleanup search from the export window finding exactly the 11 notes the window said it would.

## Facts worth knowing (verified against Anki)

- Re-import updates notes by GUID and keeps scheduling with default import options. GUID form: `bm1:{deckId}:{translation}:{BOOK}.{ch}.{v}:{unitIndex}`.
- The note type id and its field list (`Reference, Context, Answer, Hint, Info`) are frozen. Template/CSS changes need a `TEMPLATE_VERSION` bump.
- Anki matches decks by name: renaming in the app creates a second deck for new cards.
- Anki never moves existing cards: cards from a passage inserted mid-deck come up out of order among unstudied cards. Accepted for the MVP; the export window says so.
- Anki never deletes on import. Cleanup search: `tag:bm::{deckId}::* -tag:bm::{deckId}::r{revision}`.
- The Context field holds only `.line` elements; the template adds the `.context` wrapper.

## Known loose ends

- Error message style differs between `sources/static.ts` (internal invariants, `label: detail`) and `refs.ts`/`deckdef.ts` (sentences for the user). Left alone: the `static.ts` ones cannot be reached from a valid list.
- 290 BSB verses over 30 words have no usable punctuation and stay unsplit; the manual break editor covers them.
- Some agents wrote tests and code together rather than red-first; noted in their reports, not redone.
- The translation select's popup is outside the page landmarks (Bits UI portal); axe reports it as moderate.

## Backlog (not MVP)

Whole-passage card; text-to-reference card; topics/subdecks from headings; ESV via its API (500 verses or half a book per deck, shared 5,000 requests/day, needs a server route for the key); more translations; stable new-card order across updates.
