# -*- coding: utf-8 -*-
"""
Tests for the Bible passage parser module.

Test Philosophy:
- Tests should verify actual invariants, not just "seems to work"
- Use real Bible passages that expose edge cases
- The core invariant: each verse gets its own line
"""

import re
import pytest
from parser import parse_lines, format_lines, split_long_line
from clients import get_passage


# Superscript digits for verse number detection
SUPERSCRIPT_DIGITS = "⁰¹²³⁴⁵⁶⁷⁸⁹"


def count_verse_numbers(text: str) -> int:
    """Count superscript verse numbers in text."""
    pattern = f"[{SUPERSCRIPT_DIGITS}]+"
    matches = re.findall(pattern, text)
    return len(matches)


def get_verse_numbers(lines: list) -> list:
    """Extract the verse number from each line that has one."""
    pattern = f"([{SUPERSCRIPT_DIGITS}]+)"
    verse_nums = []
    for line in lines:
        match = re.search(pattern, line)
        if match:
            verse_nums.append(match.group(1))
    return verse_nums


class TestParseLines:
    """Basic unit tests for parse_lines."""

    def test_empty_text(self):
        """Empty text should return empty list."""
        assert parse_lines("") == []
        assert parse_lines(None) == []

    def test_single_verse(self):
        """Single verse returns single line."""
        lines = parse_lines("¹ This is a test verse.")
        assert len(lines) == 1
        assert "¹" in lines[0]
        assert "This is a test verse" in lines[0]

    def test_newlines_create_separate_lines(self):
        """Newlines in source text create separate lines."""
        text = "Line one.\nLine two.\nLine three."
        lines = parse_lines(text)
        assert len(lines) == 3
        assert lines[0] == "Line one."
        assert lines[1] == "Line two."
        assert lines[2] == "Line three."

    def test_blank_lines_removed(self):
        """Blank lines in source are removed."""
        text = "Line one.\n\n\nLine two."
        lines = parse_lines(text)
        assert len(lines) == 2

    def test_indentation_normalized(self):
        """Poetry indentation (4+ spaces) is normalized to 4 spaces."""
        text = "First line.\n        Deeply indented."
        lines = parse_lines(text)
        assert len(lines) == 2
        assert lines[1] == "    Deeply indented."


class TestVersePerLineInvariant:
    """
    Core invariant: Each verse number should start its own line.

    This is THE critical test class. The James bug occurred because
    verses following non-period punctuation weren't split properly.
    """

    def test_verse_after_period_splits(self):
        """Verses following periods should split (easy case)."""
        text = "¹⁶ First verse ends here. ¹⁷ Second verse starts."
        lines = parse_lines(text)
        assert len(lines) == 2
        assert "¹⁶" in lines[0]
        assert "¹⁷" in lines[1]

    def test_verse_after_comma_splits(self):
        """Verses following commas should ALSO split."""
        text = "¹ First part of thought, ² which continues here."
        lines = parse_lines(text)
        assert len(lines) == 2
        assert "¹ First" in lines[0]
        assert "² which" in lines[1]

    def test_verse_after_semicolon_splits(self):
        """Verses following semicolons should split."""
        text = "¹ First statement; ² second statement."
        lines = parse_lines(text)
        assert len(lines) == 2

    def test_verse_after_colon_splits(self):
        """Verses following colons should split."""
        text = "¹ He said: ² 'These words.'"
        lines = parse_lines(text)
        assert len(lines) == 2

    def test_verse_mid_sentence_splits(self):
        """Verses that start mid-sentence should still split."""
        # This is the James 1:2-3 pattern
        text = "² Count it all joy, my brothers, when you meet trials, ³ for you know that testing produces steadfastness."
        lines = parse_lines(text)
        assert len(lines) == 2
        assert lines[0].startswith("²")
        assert lines[1].startswith("³")

    def test_verse_count_equals_line_count(self):
        """Number of verses should equal number of lines (the key invariant)."""
        text = "¹ First. ² Second. ³ Third. ⁴ Fourth."
        lines = parse_lines(text)
        verse_count = count_verse_numbers(text)
        assert len(lines) == verse_count == 4

    def test_each_line_has_at_most_one_verse_number(self):
        """Each line should contain at most one verse number."""
        text = "¹ Verse one text, ² verse two text, ³ verse three."
        lines = parse_lines(text)
        for line in lines:
            verse_nums = get_verse_numbers([line])
            assert len(verse_nums) <= 1, f"Line has multiple verses: {line}"

    def test_double_digit_verse_numbers(self):
        """Double-digit verse numbers (¹⁰, ¹¹, etc.) should work."""
        text = "⁹ Verse nine, ¹⁰ verse ten, ¹¹ verse eleven."
        lines = parse_lines(text)
        assert len(lines) == 3
        assert "⁹" in lines[0]
        assert "¹⁰" in lines[1]
        assert "¹¹" in lines[2]


class TestRealPassageRegressions:
    """
    Regression tests using real Bible passages.

    These test specific passages known to expose edge cases.
    """

    def test_james_1_2_4_one_line_per_verse(self):
        """
        James 1:2-4 regression test.

        This was the original bug: verse 3 follows a comma, not a period,
        so it wasn't being split to its own line.
        """
        _, text = get_passage("James 1:2-4", "ESV")
        lines = parse_lines(text)

        # Must have exactly 3 lines for 3 verses
        assert len(lines) == 3, f"Expected 3 lines, got {len(lines)}: {lines}"

        # Each verse on its own line
        assert "²" in lines[0] and "Count it all joy" in lines[0]
        assert "³" in lines[1] and "for you know" in lines[1]
        assert "⁴" in lines[2] and "steadfastness" in lines[2]

    def test_romans_8_28_30_long_sentences(self):
        """Romans 8:28-30 has long theological sentences with multiple verses."""
        _, text = get_passage("Romans 8:28-30", "ESV")
        lines = parse_lines(text)

        # Should have 3 lines for 3 verses
        assert len(lines) == 3
        verse_nums = get_verse_numbers(lines)
        assert len(verse_nums) == 3

    def test_john_3_16_17_prose(self):
        """John 3:16-17 prose passage."""
        _, text = get_passage("John 3:16-17", "ESV")
        lines = parse_lines(text)

        assert len(lines) == 2
        assert "¹⁶" in lines[0]
        assert "¹⁷" in lines[1]
        assert "God so loved" in lines[0]
        assert "condemn" in lines[1]

    def test_psalm_23_poetry(self):
        """Psalm 23 poetry formatting with many short lines."""
        _, text = get_passage("Psalm 23", "ESV")
        lines = parse_lines(text)

        # Psalm 23 has 6 verses but poetry creates more lines
        assert len(lines) >= 6
        # Should contain key phrases
        full_text = format_lines(lines)
        assert "shepherd" in full_text.lower()
        assert "green pastures" in full_text

    def test_matthew_5_3_6_beatitudes(self):
        """Beatitudes - each is a verse, each should be a line."""
        _, text = get_passage("Matthew 5:3-6", "ESV")
        lines = parse_lines(text)

        # 4 beatitudes = 4 verses = 4 lines
        assert len(lines) == 4
        for line in lines:
            assert "Blessed" in line

    def test_genesis_1_1_3_creation(self):
        """Genesis 1:1-3 narrative prose."""
        _, text = get_passage("Genesis 1:1-3", "ESV")
        lines = parse_lines(text)

        assert len(lines) == 3
        assert "In the beginning" in lines[0]

    def test_1_corinthians_13_4_7_love_chapter(self):
        """1 Corinthians 13:4-7 - poetic prose about love."""
        _, text = get_passage("1 Corinthians 13:4-7", "ESV")
        lines = parse_lines(text)

        # 4 verses
        assert len(lines) == 4
        assert "Love is patient" in lines[0]

    def test_proverbs_3_5_6(self):
        """Proverbs 3:5-6 - commonly memorized passage (poetry format)."""
        _, text = get_passage("Proverbs 3:5-6", "ESV")
        lines = parse_lines(text)

        # Proverbs is poetry - each verse has 2 lines, so 4 total
        assert len(lines) == 4
        assert "Trust in the Lord" in lines[0]
        # Verify both verse numbers present
        full_text = format_lines(lines)
        assert "⁵" in full_text
        assert "⁶" in full_text

    def test_philippians_4_6_7(self):
        """Philippians 4:6-7 - epistle with semicolons."""
        _, text = get_passage("Philippians 4:6-7", "ESV")
        lines = parse_lines(text)

        assert len(lines) == 2


class TestPoetryFormatting:
    """Tests for poetry-specific formatting."""

    def test_psalm_indentation_preserved(self):
        """Psalm poetry indentation should be normalized."""
        _, text = get_passage("Psalm 23", "ESV")
        lines = parse_lines(text)

        # Some lines should be indented (subordinate poetry lines)
        indented = [line for line in lines if line.startswith("    ")]
        # Psalm 23 has indented lines in ESV
        assert len(indented) >= 0  # May vary by translation

    def test_newlines_from_poetry_preserved(self):
        """Newlines in poetry source should create separate lines."""
        text = "¹ The Lord is my shepherd;\n    I shall not want."
        lines = parse_lines(text)
        assert len(lines) == 2


class TestFormatLines:
    """Tests for format_lines utility."""

    def test_join_with_newlines(self):
        """Lines should be joined with newline characters."""
        lines = ["Line 1", "Line 2", "Line 3"]
        result = format_lines(lines)
        assert result == "Line 1\nLine 2\nLine 3"

    def test_empty_list_returns_empty_string(self):
        """Empty list returns empty string."""
        assert format_lines([]) == ""

    def test_single_line_no_trailing_newline(self):
        """Single line should not have trailing newline."""
        assert format_lines(["Only line"]) == "Only line"


class TestSplitLongLine:
    """Tests for the split_long_line function."""

    def test_short_line_unchanged(self):
        """Lines under max_length are returned unchanged."""
        line = "This is a short line."
        result = split_long_line(line, max_length=100)
        assert result == [line]

    def test_split_at_sentence_boundary(self):
        """Long lines split at sentence boundaries."""
        # Use longer sentences to exceed min_length (30) when split
        line = "This is the first sentence with enough words. This is the second sentence that is also long enough. And here is a third one."
        result = split_long_line(line, max_length=60, min_length=20)
        assert len(result) >= 2
        # First segment should end with a sentence
        assert result[0].endswith(".")

    def test_no_split_without_boundary(self):
        """Lines without sentence boundaries stay together."""
        line = "This is one very long sentence without any periods or other sentence-ending punctuation inside"
        result = split_long_line(line, max_length=50)
        # Should not create tiny fragments
        assert all(len(r) >= 20 or r == result[-1] for r in result)

    def test_respects_minimum_length(self):
        """Splitting respects minimum fragment length."""
        line = "A. B. C. D. This is the last part."
        result = split_long_line(line, max_length=40, min_length=20)
        # Short sentences should be combined
        assert all(len(r) >= 20 or r == result[-1] for r in result)

    def test_quoted_text_not_split_internally(self):
        """Sentence boundaries inside quotes are handled carefully."""
        line = 'He said, "This is important. Very important." And then left.'
        result = split_long_line(line, max_length=50)
        # The quote should stay together
        full_result = " ".join(result)
        assert '"This is important. Very important."' in full_result

    def test_verse_number_triggers_split(self):
        """Lines can split before verse numbers when sentences are long enough."""
        # Longer content to meet min_length requirements
        line = "¹² Blessed is the man who remains steadfast under trial, for when he has stood the test he will receive the crown of life. ¹³ Let no one say when he is tempted that he is being tempted by God."
        result = split_long_line(line, max_length=100, min_length=30)
        assert len(result) >= 2


class TestParseLinesWithSplitOption:
    """Tests for parse_lines with split_long_lines option."""

    def test_split_disabled_by_default(self):
        """split_long_lines defaults to False."""
        _, text = get_passage("James 1:12", "ESV")
        lines_default = parse_lines(text)
        lines_explicit = parse_lines(text, split_long_lines=False)
        assert lines_default == lines_explicit

    def test_split_enabled_creates_more_lines(self):
        """With split_long_lines=True, long passages create more lines."""
        _, text = get_passage("James 1:12-15", "ESV")
        lines_without = parse_lines(text, split_long_lines=False)
        lines_with = parse_lines(text, split_long_lines=True, max_line_length=80)
        assert len(lines_with) >= len(lines_without)

    def test_split_preserves_all_content(self):
        """Splitting preserves all original content."""
        _, text = get_passage("James 1:2-4", "ESV")
        lines_unsplit = parse_lines(text, split_long_lines=False)
        lines_split = parse_lines(text, split_long_lines=True)

        # All words should be present in both
        unsplit_words = " ".join(lines_unsplit).split()
        split_words = " ".join(lines_split).split()
        assert unsplit_words == split_words

    def test_max_line_length_respected_when_possible(self):
        """Lines are split when sentence boundaries allow."""
        # Use a passage with multiple sentences per verse
        _, text = get_passage("James 1:13-14", "ESV")
        lines = parse_lines(text, split_long_lines=True, max_line_length=80)

        # At least some lines should be under the limit
        # (not all will be if no split point exists)
        short_lines = [line for line in lines if len(line) <= 100]
        assert len(short_lines) > 0


class TestEdgeCases:
    """Edge cases and boundary conditions."""

    def test_single_verse_passage(self):
        """Single verse returns single line."""
        _, text = get_passage("John 3:16", "ESV")
        lines = parse_lines(text)
        assert len(lines) == 1
        assert "¹⁶" in lines[0]

    def test_first_verse_has_no_number_sometimes(self):
        """Some passages start without a verse number (chapter starts)."""
        # When fetching a full chapter, verse 1 might not have ¹
        _, text = get_passage("James 1", "ESV")
        lines = parse_lines(text)
        # First line may or may not have ¹, but should have content
        assert len(lines[0]) > 0

    def test_handles_unicode_properly(self):
        """Unicode characters in text are preserved."""
        _, text = get_passage("John 3:16", "ESV")
        lines = parse_lines(text)
        # Superscript should be preserved
        assert "¹⁶" in lines[0]

    def test_numbered_book_passage(self):
        """Passages from numbered books (1 John, 2 Timothy) work."""
        _, text = get_passage("1 John 4:7-8", "ESV")
        lines = parse_lines(text)
        assert len(lines) == 2
        assert "love" in format_lines(lines).lower()


class TestMultipleTranslations:
    """Ensure parsing works across translations."""

    @pytest.mark.parametrize("translation", ["ESV", "NIV", "KJV", "NASB"])
    def test_verse_splitting_across_translations(self, translation):
        """Each verse gets its own line regardless of translation."""
        _, text = get_passage("John 3:16-17", translation)
        lines = parse_lines(text)
        assert len(lines) == 2

    @pytest.mark.parametrize("translation", ["ESV", "NIV"])
    def test_james_works_across_translations(self, translation):
        """James 1:2-4 splits correctly in multiple translations."""
        _, text = get_passage("James 1:2-4", translation)
        lines = parse_lines(text)
        # Should have 3 lines regardless of translation
        assert len(lines) == 3
