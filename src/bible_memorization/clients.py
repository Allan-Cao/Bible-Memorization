"""
Bible passage client using the meaningless library.
Supports multiple Bible translations via Bible Gateway.
"""

import re

from meaningless import WebExtractor

# Supported translations (subset of what meaningless supports)
SUPPORTED_TRANSLATIONS = [
    "ESV",
    "NIV",
    "NKJV",
    "NLT",
    "KJV",
    "NASB",
    "CSB",
    "NET",
    "RSV",
    "NRSV",
    "ASV",
]

DEFAULT_TRANSLATION = "ESV"


def parse_verse_reference(ref: str) -> tuple:
    """
    Parse a verse reference string into components for meaningless API.

    Supports formats:
        "John 3:16"           -> (book, chapter, verse, verse)
        "John 3:16-17"        -> (book, chapter, verse_start, verse_end)
        "Psalm 23"            -> (book, chapter, None, None) [full chapter]
        "1 John 3:1-2"        -> handles numbered books
        "Psalm 46:1-3"        -> (book, chapter, 1, 3)

    Returns:
        (book, chapter, verse_start, verse_end) where verse_start/end are None for full chapters
    """
    ref = ref.strip()

    # Pattern to match: "Book Chapter:Verse-Verse" or "Book Chapter:Verse" or "Book Chapter"
    # Book can have numbers prefix (1 John, 2 Timothy, etc.)
    pattern = r"^(.+?)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$"
    match = re.match(pattern, ref)

    if not match:
        raise ValueError(f"Invalid verse reference format: {ref}")

    book = match.group(1)
    chapter = int(match.group(2))
    verse_start = int(match.group(3)) if match.group(3) else None
    verse_end = int(match.group(4)) if match.group(4) else verse_start

    return book, chapter, verse_start, verse_end


def get_passage(verse_ref: str, translation: str = DEFAULT_TRANSLATION) -> tuple:
    """
    Fetch a Bible passage using the meaningless library.

    Args:
        verse_ref: Reference string like "John 3:16", "Psalm 23", "Romans 8:38-39"
        translation: Bible translation code (ESV, NIV, NKJV, etc.)

    Returns:
        (canonical_ref, text) tuple where:
            - canonical_ref is the normalized reference string
            - text is the passage text with superscript verse numbers
    """
    if translation not in SUPPORTED_TRANSLATIONS:
        raise ValueError(
            f"Unsupported translation: {translation}. "
            f"Supported: {', '.join(SUPPORTED_TRANSLATIONS)}"
        )

    bible = WebExtractor(translation=translation, show_passage_numbers=True)

    book, chapter, verse_start, verse_end = parse_verse_reference(verse_ref)

    # Fetch the passage
    if verse_start is None:
        # Full chapter
        text = bible.get_chapter(book, chapter)
        canonical = f"{book} {chapter}"
    elif verse_start == verse_end:
        # Single verse
        text = bible.get_passage(book, chapter, verse_start)
        canonical = f"{book} {chapter}:{verse_start}"
    else:
        # Verse range within same chapter
        text = bible.get_passage_range(book, chapter, verse_start, chapter, verse_end)
        canonical = f"{book} {chapter}:{verse_start}-{verse_end}"

    if not text:
        raise ValueError(f"No passage found for: {verse_ref}")

    return canonical, text
