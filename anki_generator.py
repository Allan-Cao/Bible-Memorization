# -*- coding: utf-8 -*-
"""
Bible Memorization Anki Deck Generator

Sequential line-by-line memorization with overlapping context.
Each card slides by 1 line, reinforcing previously learned lines.
"""

import argparse
import hashlib
from pathlib import Path
from typing import TypedDict

import genanki

from clients import get_passage, DEFAULT_TRANSLATION
from parser import parse_lines, format_lines


def load_verses(path: str | Path) -> list[str]:
    """Load verse references from a text file (one per line, # for comments)."""
    verses = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#"):
                verses.append(line)
    return verses


class CardData(TypedDict):
    """Structure for a single flashcard."""

    title: str
    context: str
    prompt: str
    answer: str
    sequence: int


def stable_id(name: str) -> int:
    """Generate stable ID from name (survives Python restarts)."""
    return int(hashlib.md5(name.encode()).hexdigest()[:8], 16)


# --- Styling (dark mode) ---

CARD_CSS = """
.card {
    font-family: Georgia, serif;
    font-size: 24px;
    line-height: 1.6;
    padding: 20px;
    background-color: #1a1a1a;
    color: #e0e0e0;
}
.title {
    font-weight: bold;
    font-size: 20px;
    color: white;
    margin-bottom: 15px;
}
.context {
    white-space: pre-wrap;
    margin-bottom: 15px;
}
.prompt {
    color: #888;
    font-style: italic;
    margin-top: 10px;
}
.answer {
    white-space: pre-wrap;
}
hr {
    border: none;
    border-top: 1px solid #444;
    margin: 20px 0;
}
"""


def make_model(model_id: int) -> genanki.Model:
    """Create Anki note model."""
    return genanki.Model(
        model_id,
        "Bible Memorization",
        fields=[
            {"name": "Title"},
            {"name": "Context"},
            {"name": "Prompt"},
            {"name": "Answer"},
            {"name": "Sequence"},
            {"name": "Reference"},
        ],
        templates=[
            {
                "name": "Recite",
                "qfmt": (
                    '<div class="title">{{Title}}</div>'
                    "{{#Context}}"
                    '<div class="context">{{Context}}</div>'
                    "{{/Context}}"
                    '<div class="prompt">{{Prompt}}</div>'
                ),
                "afmt": (
                    '<div class="title">{{Title}}</div>'
                    "{{#Context}}"
                    '<div class="context">{{Context}}</div>'
                    "{{/Context}}"
                    "<hr>"
                    '<div class="answer">{{Answer}}</div>'
                ),
            }
        ],
        css=CARD_CSS,
    )


def generate_cards(
    canonical: str,
    lines: list[str],
    context_lines: int,
    recite_lines: int,
) -> list[CardData]:
    """
    Generate cards with OVERLAPPING context (sliding window).

    Pattern: AB -> CD, BC -> DE, CD -> EF
    Each card after the first slides by 1 line.
    """
    cards = []
    total = len(lines)

    if total == 0:
        return cards

    # Single short passage: one card
    if total <= recite_lines:
        cards.append(
            {
                "title": canonical,
                "context": "",
                "prompt": f"Recite {canonical}",
                "answer": format_lines(lines),
                "sequence": 1,
            }
        )
        return cards

    # Card 0: first recite_lines with no context (bootstrap)
    cards.append(
        {
            "title": f"{canonical} (1/?)",
            "context": "",
            "prompt": f"[...{recite_lines} lines]",
            "answer": format_lines(lines[0:recite_lines]),
            "sequence": 1,
        }
    )

    # Subsequent cards: slide by 1 line each
    # ans_start for card k (k>=1): recite_lines + k - 1
    k = 1
    while True:
        ans_start = recite_lines + k - 1
        ans_end = ans_start + recite_lines

        if ans_start >= total:
            break

        # Clamp answer to available lines
        ans_end = min(ans_end, total)
        ans_lines = lines[ans_start:ans_end]

        # Context: previous context_lines lines
        ctx_start = max(0, ans_start - context_lines)
        ctx_lines = lines[ctx_start:ans_start]

        num_ans = len(ans_lines)
        prompt = f"[...{num_ans} line{'s' if num_ans > 1 else ''}]"

        cards.append(
            {
                "title": f"{canonical} ({k+1}/?)",
                "context": format_lines(ctx_lines),
                "prompt": prompt,
                "answer": format_lines(ans_lines),
                "sequence": k + 1,
            }
        )

        k += 1

    # Update titles with total count
    total_cards = len(cards)
    for card in cards:
        card["title"] = card["title"].replace("?", str(total_cards))

    return cards


def generate_deck(
    verse_list: list[str],
    deck_name: str,
    output_file: str,
    context_lines: int = 2,
    recite_lines: int = 2,
    deck_id: int | None = None,
    model_id: int | None = None,
    translation: str = DEFAULT_TRANSLATION,
    split_long_lines: bool = False,
    max_line_length: int = 100,
) -> int:
    """
    Generate Anki deck from verse references.

    Args:
        verse_list: ["John 3:16", "Psalm 23", ...]
        deck_name: Name shown in Anki
        output_file: Output .apkg path
        context_lines: Number of context lines to show
        recite_lines: Number of lines to recall
        deck_id: Unique deck ID (auto-generated if None)
        model_id: Unique model ID (auto-generated if None)
        translation: Bible translation code (ESV, NIV, NKJV, etc.)
        split_long_lines: If True, split long verses at sentence boundaries
        max_line_length: Target maximum line length when split_long_lines=True
    """
    # Generate stable IDs from deck name if not provided
    if deck_id is None:
        deck_id = stable_id(deck_name)
    if model_id is None:
        model_id = stable_id(deck_name + "_model")

    model = make_model(model_id)
    deck = genanki.Deck(deck_id, deck_name)

    print(f"Generating: {deck_name}")
    print(f"Translation: {translation}")
    print(f"Context: {context_lines} lines, Recite: {recite_lines} lines")
    print(f"Deck ID: {deck_id}, Model ID: {model_id}")
    print("-" * 40)

    total_cards = 0

    for ref in verse_list:
        print(f"{ref}...", end=" ", flush=True)

        try:
            canonical, text = get_passage(ref, translation)
            lines = parse_lines(
                text,
                split_long_lines=split_long_lines,
                max_line_length=max_line_length,
            )
            cards = generate_cards(canonical, lines, context_lines, recite_lines)

            for card in cards:
                note = genanki.Note(
                    model=model,
                    fields=[
                        card["title"],
                        card["context"],
                        card["prompt"],
                        card["answer"],
                        str(card["sequence"]),
                        canonical,
                    ],
                )
                deck.add_note(note)
                total_cards += 1

            print(f"{len(lines)} lines -> {len(cards)} cards")

        except Exception as e:
            print(f"ERROR: {e}")

    genanki.Package(deck).write_to_file(output_file)
    print("-" * 40)
    print(f"Saved: {output_file} ({total_cards} cards)")

    return total_cards


def main():
    from clients import SUPPORTED_TRANSLATIONS

    parser = argparse.ArgumentParser(
        description="Generate Anki flashcards for Bible memorization"
    )
    parser.add_argument(
        "file",
        help="Text file with verse references (one per line)",
    )
    parser.add_argument(
        "-o",
        "--output",
        default="output.apkg",
        help="Output .apkg file (default: output.apkg)",
    )
    parser.add_argument(
        "-n",
        "--name",
        help="Deck name (default: derived from filename)",
    )
    parser.add_argument(
        "-t",
        "--translation",
        default="ESV",
        choices=SUPPORTED_TRANSLATIONS,
        help="Bible translation (default: ESV)",
    )
    parser.add_argument(
        "--context",
        type=int,
        default=2,
        help="Context lines to show (default: 2)",
    )
    parser.add_argument(
        "--recite",
        type=int,
        default=2,
        help="Lines to recite per card (default: 2)",
    )
    parser.add_argument(
        "--split-lines",
        action="store_true",
        help="Split long lines at sentence boundaries",
    )
    parser.add_argument(
        "--max-length",
        type=int,
        default=100,
        help="Max line length when splitting (default: 100)",
    )

    args = parser.parse_args()

    verses = load_verses(args.file)
    if not verses:
        parser.error(f"No verses found in {args.file}")

    deck_name = args.name or Path(args.file).stem

    generate_deck(
        verse_list=verses,
        deck_name=deck_name,
        output_file=args.output,
        translation=args.translation,
        context_lines=args.context,
        recite_lines=args.recite,
        split_long_lines=args.split_lines,
        max_line_length=args.max_length,
    )


if __name__ == "__main__":
    main()
