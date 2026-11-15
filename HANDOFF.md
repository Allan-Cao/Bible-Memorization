# Handoff note (2026-11-14)

Temporary file for whoever continues the TypeScript rewrite. Delete it when the rewrite is merged.

The approved plan is at `/home/allan/.claude/plans/could-you-review-the-async-tome.md`. `CLAUDE.md` describes the stack, commands and conventions. Work is on branch `ts-rewrite`; nothing is pushed.

## Owner's standing instructions

- TDD for core logic: see the test fail before implementing.
- UI is Bits UI primitives plus Tailwind utilities. No hand-written CSS.
- Conventional Commits, committed often, by sub-agents too.
- Small, human-readable modules. No speculative features.
- No backward compatibility with the old Python tool (deleted).
- ESV is out until Allan hears back from Crossway. The site is fully static.
- Delegate generously to sub-agents (Sonnet routine, Opus careful) to save the main context. **Allan is now on usage credits: do not launch agents without need, and ask before large ones.**

## Done and committed

| Area       | Files                                                                                         | State                                                                                             |
| ---------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Scaffold   | SvelteKit 3.2, Svelte 5, Tailwind 4.3, Bits UI 2.21, adapter-static                           | check, lint, test, build pass                                                                     |
| Types      | `src/lib/core/model.ts`                                                                       | the contract between modules                                                                      |
| References | `books.ts`, `refs.ts`, `list.ts`                                                              | strict parsing, normalized labels, line-numbered errors                                           |
| Bible text | `scripts/build-text.ts`, `static/text/{bsb,web,kjv}/`, `versification.*`, `sources/static.ts` | eBible USFM converted; `npm run build:text` regenerates                                           |
| Cards      | `units.ts`, `render.ts`, `cards.ts`, `translations.ts`                                        | one verse per card; long verses split (30-word threshold, 35-word soft cap, 10-word minimum part) |
| Anki       | `anki/notetype.ts`, `anki/apkg.ts`, `scripts/anki-import-check.py`                            | verified against Anki 26.09.4's importer                                                          |
| Deck       | `deckdef.ts`, `diff.ts`, `build.ts`                                                           | definition, share links, export diff, cleanup search, pipeline                                    |

Last known full-suite result: 520 tests passing (before the UI work started). Golden files for human review: `tests/golden/text/` and `tests/golden/cards/{bsb,web,kjv}/`.

## In progress when this note was written

An Opus sub-agent was building the UI (`src/routes/`, `src/lib/ui/`), a size limit on `decodeShare` in `deckdef.ts`, and a Playwright smoke test. It commits per component. **Its result had not come back.** First thing to do:

1. `git status` and `git log --oneline` to see what it committed and whether uncommitted work is lying around.
2. Run `npm run check && npm run lint && npm test && npm run build`. A `deckdef.test.ts` share-link size-limit test was failing mid-way (written test-first); confirm it is green or finish it.
3. Review the UI against the brief below, and look at its screenshots if present in the session scratchpad `ui/` folder (may be gone after a reboot; retake with the dev server).

UI brief in short: Home (decks, new deck, OT/NT examples from Billy Graham's decision card, open deck file); `/deck/[id]` editor (name, translation Select, list textarea with inline errors, live card preview in Collapsibles, click between words to add/remove a break, Export, Share); Export dialog (download, change summary, cleanup search with copy, rename and ordering warnings); Share dialog (link to `/open#...`, deck file); `/open`; `/about` with text sources. Plain language: no "GUID", "note type" or "revision" in the UI.

## Facts worth knowing (verified against Anki)

- Re-import updates notes by GUID and keeps scheduling with default import options. GUID form: `bm1:{deckId}:{translation}:{BOOK}.{ch}.{v}:{unitIndex}`.
- The note type id and its field list (`Reference, Context, Answer, Hint, Info`) are frozen. Template/CSS changes need a `TEMPLATE_VERSION` bump.
- Anki matches decks by name: renaming in the app creates a second deck for new cards.
- Anki never moves existing cards: cards from a passage inserted mid-deck come up out of order among unstudied cards. Accepted for the MVP; the export dialog should mention it.
- Anki never deletes on import. Cleanup search: `tag:bm::{deckId}::* -tag:bm::{deckId}::r{revision}`.
- The Context field holds only `.line` elements; the template adds the `.context` wrapper.

## Remaining work

1. Finish and review the UI (above).
2. Manual check: import a real exported deck into Anki desktop and a phone (AnkiDroid/AnkiMobile untested), re-import an update, run the cleanup search, tap the hint.
3. Ask Allan to read the golden card files and confirm the card design.
4. README rewrite; delete this file.
5. Cloudflare deploy (static assets only, must cost nothing). Needs Allan's account.
6. Merge `ts-rewrite` when Allan is happy.

## Known loose ends

- `refs.ts`: the single-chapter label rule is written twice (`itemLabel`, `verseLabel`).
- Error message style differs between `sources/static.ts` and `refs.ts`/`deckdef.ts`.
- `apkg.ts` `sortField` decodes entities that `escapeHtml` never produces.
- Long psalm titles (Psalm 18, 60) show as long lead-ins with no distinct styling.
- 290 BSB verses over 30 words have no usable punctuation and stay unsplit; the manual break editor covers them.
- Some agents wrote tests and code together rather than red-first; noted in their reports, not redone.

## Backlog (not MVP)

Whole-passage card; text-to-reference card; topics/subdecks from headings; ESV via its API (500 verses or half a book per deck, shared 5,000 requests/day, needs a server route for the key); more translations; stable new-card order across updates.
