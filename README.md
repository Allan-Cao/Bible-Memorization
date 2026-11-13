# Bible Memorization

Generates Anki flashcards for Bible memorization using a sliding-window approach with overlapping context.

> *I have stored up your word in my heart, that I might not sin against you.* — Psalm 119:11

## Installation

```bash
uv sync
```

## Usage

```bash
uv run bible-memorization verses/nathan.txt -o nathan.apkg
uv run bible-memorization verses/tms.txt -o tms.apkg -t NIV
uv run bible-memorization my_verses.txt --split-lines --context 3
```

Import the `.apkg` file into Anki.

## How It Works

Each passage is split into lines (one per verse). Cards use a sliding window:

1. **Card 1**: Recite lines 1-2 (no context)
2. **Card 2**: Given line 1, recite lines 2-3
3. **Card 3**: Given lines 2-3, recite lines 3-4
4. ...and so on

This reinforces previously learned lines while introducing new material.

## Verse Lists

See `verses/` folder. Format: one verse per line, `#` for comments.

| File | Description |
|------|-------------|
| `verses/ot.txt` | 25 Old Testament passages |
| `verses/nt.txt` | 18 New Testament passages |
| `verses/tms.txt` | 60 Topical Memory System verses |
| `verses/nathan.txt` | 34 curated memory verses |
| `verses/mohammed.txt` | James + John (full books) |

## Development

```bash
uv run pytest -n auto                               # Run tests
uv run pytest --cov                                 # With coverage
uv run ruff check --fix . && uv run ruff format .   # Lint + format
```
