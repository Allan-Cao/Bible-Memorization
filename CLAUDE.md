# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bible Memorization is a Python tool that generates Anki flashcards using a sliding-window approach with overlapping context for memorizing Bible passages.

## Commands

### Setup
```bash
pip install -r requirements.txt
```

### Testing
```bash
pytest                                    # Run all tests
pytest --cov=. --cov-report=term-missing  # With coverage
pytest -n auto                            # Parallel execution
pytest tests/test_anki_generator.py::TestGenerateCards::test_sliding_window_progression  # Single test
pytest -m "not slow and not network"      # Exclude slow/network tests
```

### Linting
```bash
black *.py tests/*.py  # Format code
pylint *.py            # Lint source files
```

### Running
```bash
python anki_generator.py verses/nathan.txt                     # Basic usage
python anki_generator.py verses/tms.txt -o tms.apkg -t NIV     # Custom output and translation
python anki_generator.py verses/ot.txt --split-lines           # Split long lines
```

## Architecture

### Core Modules

- **anki_generator.py** - Main orchestrator. `generate_deck()` fetches passages and creates .apkg files. `generate_cards()` implements the sliding-window algorithm where each card slides by 1 line, using previous lines as context.

- **clients.py** - Bible passage retrieval via `meaningless` library (Bible Gateway scraper). `get_passage()` fetches text, supporting ESV, NIV, NKJV, NLT, KJV, NASB, CSB, NET, RSV, NRSV, ASV.

- **parser.py** - Text processing. `parse_lines()` converts raw Bible text (with superscript verse numbers) into line arrays, normalizing poetry indentation. `split_long_line()` breaks long lines at sentence boundaries.

- **verses/** - Verse list text files. Format: one verse reference per line, # for comments.

### Sliding Window Algorithm

For an 8-line passage with context_lines=2, recite_lines=2:
```
Card 1: [Context: empty]    → [Recite: lines 1-2]
Card 2: [Context: line 1]   → [Recite: lines 2-3]
Card 3: [Context: lines 2-3] → [Recite: lines 3-4]
...
```
Each card reinforces the previous content through progressive overlap.

### Key Design Patterns

- **Stable IDs**: MD5-based deterministic IDs from passage names ensure deck consistency across regenerations
- **Network Caching**: Test fixtures use LRU-cached Bible passages to minimize API calls
- **Error Resilience**: Deck generation continues despite individual passage fetch failures

## API Usage

```python
from anki_generator import generate_deck, load_verses

# Load verses from a text file
verses = load_verses("my_verses.txt")

generate_deck(
    verse_list=verses,
    deck_name="Memory Verses",
    output_file="verses.apkg",
    translation="ESV",
    context_lines=2,
    recite_lines=2,
    split_long_lines=True,
    max_line_length=100,
)
```
