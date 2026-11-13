"""
Parse Bible passage text into lines for memorization.
Works with text from the meaningless library (Bible Gateway).
"""

import re

# Superscript digits used by meaningless library
SUPERSCRIPT_DIGITS = "⁰¹²³⁴⁵⁶⁷⁸⁹"


def split_long_line(
    line: str, max_length: int = 100, min_length: int = 30
) -> list[str]:
    """
    Split a long line at sentence boundaries.

    Args:
        line: The line to potentially split
        max_length: Maximum desired line length
        min_length: Minimum acceptable fragment length

    Returns:
        List of line fragments (or single-element list if no split possible)
    """
    if len(line) <= max_length:
        return [line]

    # Find sentence boundaries: punctuation followed by space and capital/verse number
    pattern = r"(?<=[.!?])\s+(?=[A-Z⁰¹²³⁴⁵⁶⁷⁸⁹])"
    split_positions = [m.end() for m in re.finditer(pattern, line)]

    if not split_positions:
        return [line]

    # Build segments greedily
    segments = []
    start = 0

    for pos in split_positions:
        segment = line[start:pos].strip()
        # Split if current segment is long enough and remainder still needs splitting
        if len(segment) >= min_length and len(line[start:]) > max_length:
            segments.append(segment)
            start = pos

    # Add final segment
    final = line[start:].strip()
    if final:
        if len(final) < min_length and segments:
            segments[-1] += " " + final
        else:
            segments.append(final)

    return segments if len(segments) > 1 else [line]


def parse_lines(
    text: str,
    split_long_lines: bool = False,
    max_line_length: int = 100,
    min_line_length: int = 30,
) -> list[str]:
    """
    Parse Bible passage text into list of display lines.

    The meaningless library returns text with:
    - Superscript verse numbers (¹, ², etc.)
    - Newlines for poetry formatting
    - Indentation with spaces for subordinate poetry lines

    Each verse is split to its own line. Optionally, long lines can be
    further split at sentence boundaries.

    Args:
        text: Raw Bible passage text
        split_long_lines: If True, split long lines at sentence boundaries
        max_line_length: Target maximum line length when splitting
        min_line_length: Minimum fragment length to avoid tiny pieces

    Returns:
        List of strings, each is one line to memorize.
    """
    if not text:
        return []

    lines = []

    # First, split by newlines (poetry formatting)
    for raw_chunk in text.split("\n"):
        if not raw_chunk.strip():
            continue

        # Split at verse numbers: any whitespace before superscript digits
        # Pattern: split before a verse number (but keep the verse number with its text)
        verse_split = re.split(r"(?=\s[⁰¹²³⁴⁵⁶⁷⁸⁹]+\s)", raw_chunk)

        for part in verse_split:
            stripped = part.strip()
            if not stripped:
                continue

            # Normalize indentation for poetry
            # 4+ spaces at original start = subordinate poetry line (indent)
            leading = len(part) - len(part.lstrip())
            content = stripped

            if leading >= 4:
                lines.append("    " + content)
            else:
                lines.append(content)

    # Optionally split long lines at sentence boundaries
    if split_long_lines:
        expanded_lines = []
        for line in lines:
            expanded_lines.extend(
                split_long_line(line, max_line_length, min_line_length)
            )
        lines = expanded_lines

    return lines


def format_lines(lines: list[str]) -> str:
    """Join lines with newlines for display."""
    return "\n".join(lines)
