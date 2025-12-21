# Bible Memorization

Generates Anki flashcards for Bible memorization using a sliding-window approach with overlapping context.

> *I have stored up your word in my heart, that I might not sin against you.* — Psalm 119:11

## Installation

```bash
pip install -r requirements.txt
```

## Usage

```python
from anki_generator import generate_deck
from verse_lists import NATHAN_LIST, TMS_ALL

generate_deck(
    verse_list=NATHAN_LIST,
    deck_name="My Memory Verses",
    output_file="verses.apkg",
    translation="ESV",  # ESV, NIV, KJV, NASB, NKJV, NLT, CSB, NET, RSV, NRSV, ASV
)
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

| List | Description |
|------|-------------|
| `OT` | 25 Old Testament passages |
| `NT` | 18 New Testament passages |
| `TMS_ALL` | 60 Topical Memory System verses |
| `NATHAN_LIST` | 34 curated memory verses |
| `MOHAMMED_LIST` | James + John (full books) |

## Development

```bash
# Run tests
pytest

# Run with coverage
pytest --cov=. --cov-report=term-missing
```
