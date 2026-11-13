# CLAUDE.md

Generates Anki decks (`.apkg`) for Bible memorization. Each card shows a few previous lines as context and asks for the next lines; the window slides one line per card. See README.md for user-facing usage.

## Commands

Uses [uv](https://docs.astral.sh/uv/). All config lives in `pyproject.toml`.

```bash
uv sync                                      # install deps + dev group into .venv
uv run bible-memorization verses/tms.txt -o tms.apkg -t NIV
uv run pytest -n auto                        # tests (parallel)
uv run pytest --cov                          # coverage (config in pyproject)
uv run ruff check --fix . && uv run ruff format .
```

## Layout

`src/bible_memorization/`:
- `anki_generator.py`: CLI (`main`), `generate_deck`, and the sliding-window `generate_cards`
- `clients.py`: fetches passages through `meaningless` (scrapes Bible Gateway)
- `parser.py`: turns raw passage text into lines

Always import through the package (`from bible_memorization.parser import ...`). A bare `import parser` was ambiguous with the old stdlib module of the same name.

## Things that will surprise you

- **Most tests hit the network.** They scrape Bible Gateway live, with no mocks. `tests/conftest.py` caches fetches per session through `passage_cache`. The `network`/`slow` markers are registered but no test uses them yet, so `-m "not network"` deselects nothing. If tests fail all at once, check connectivity or Bible Gateway markup changes before suspecting the code.
- **Changing card output resets review history.** Notes are created without an explicit `guid`, so genanki derives each note's guid from all of its fields. Any change to titles, prompts, or line splitting makes Anki see new notes, and existing users lose their progress on those cards.
- **Deck and model IDs come from the deck name** (`stable_id`, an MD5 prefix). The CLI's default deck name is the input filename stem, so renaming the verse file or passing a different `-n` creates a separate deck in Anki.
- **Fetch errors are swallowed per passage.** `generate_deck` prints `ERROR: ...` and keeps going, so a bad reference still yields a "successful" deck that is missing that passage.
- **Parser input format:** `meaningless` returns verse numbers as Unicode superscripts (`¹²³`). The parser splits verses on those. A chunk with 4+ leading spaces is treated as an indented poetry line and normalized to exactly 4 spaces.
- **Reference parsing** (`parse_verse_reference`) supports only `Book C`, `Book C:V`, and `Book C:V-V`. Cross-chapter ranges such as `John 3:16-4:2` are rejected.

## Conventions

- Ruff handles both lint and format, using its built-in default rule set (no `[tool.ruff]` config in `pyproject.toml`). Use a targeted `# noqa` rather than a behavior change when a lint fix would alter logic.
- Verse lists in `verses/` are plain text: one reference per line, `#` for comments.
