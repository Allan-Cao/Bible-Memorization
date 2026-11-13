"""
Tests for the Bible passage client module.
"""

import pytest

from bible_memorization.clients import (
    DEFAULT_TRANSLATION,
    SUPPORTED_TRANSLATIONS,
    get_passage,
    parse_verse_reference,
)


class TestParseVerseReference:
    """Tests for verse reference parsing."""

    def test_single_verse(self):
        """Parse a single verse reference."""
        book, chapter, start, end = parse_verse_reference("John 3:16")
        assert book == "John"
        assert chapter == 3
        assert start == 16
        assert end == 16

    def test_verse_range(self):
        """Parse a verse range in same chapter."""
        book, chapter, start, end = parse_verse_reference("Romans 8:38-39")
        assert book == "Romans"
        assert chapter == 8
        assert start == 38
        assert end == 39

    def test_full_chapter(self):
        """Parse a full chapter reference."""
        book, chapter, start, end = parse_verse_reference("Psalm 23")
        assert book == "Psalm"
        assert chapter == 23
        assert start is None
        assert end is None

    def test_numbered_book(self):
        """Parse a book with a number prefix."""
        book, chapter, start, end = parse_verse_reference("1 John 3:1-2")
        assert book == "1 John"
        assert chapter == 3
        assert start == 1
        assert end == 2

    def test_numbered_book_single_verse(self):
        """Parse a numbered book with single verse."""
        book, chapter, start, end = parse_verse_reference("2 Timothy 3:16")
        assert book == "2 Timothy"
        assert chapter == 3
        assert start == 16
        assert end == 16

    def test_book_with_long_name(self):
        """Parse books with multi-word names."""
        book, chapter, start, end = parse_verse_reference("Song of Solomon 2:4")
        assert book == "Song of Solomon"
        assert chapter == 2
        assert start == 4
        assert end == 4

    def test_invalid_format(self):
        """Invalid reference format should raise ValueError."""
        with pytest.raises(ValueError, match="Invalid verse reference"):
            parse_verse_reference("invalid")

    def test_whitespace_handling(self):
        """Extra whitespace should be handled."""
        book, chapter, _start, _end = parse_verse_reference("  John 3:16  ")
        assert book == "John"
        assert chapter == 3


class TestGetPassage:
    """Tests for passage retrieval."""

    def test_get_single_verse(self):
        """Retrieve a single verse."""
        canonical, text = get_passage("John 3:16", "ESV")
        assert canonical == "John 3:16"
        assert "God so loved the world" in text
        # Should have superscript verse number
        assert "¹⁶" in text

    def test_get_verse_range(self):
        """Retrieve a verse range."""
        canonical, text = get_passage("John 3:16-17", "ESV")
        assert canonical == "John 3:16-17"
        assert "God so loved" in text
        assert "condemn the world" in text

    def test_get_full_chapter(self):
        """Retrieve a full chapter."""
        canonical, text = get_passage("Psalm 23", "ESV")
        assert canonical == "Psalm 23"
        assert "shepherd" in text
        assert "green pastures" in text

    def test_poetry_formatting(self):
        """Poetry should have newlines for formatting."""
        _canonical, text = get_passage("Psalm 23", "ESV")
        assert "\n" in text  # Poetry has line breaks

    def test_different_translation(self):
        """Test with a different translation."""
        canonical, text = get_passage("John 3:16", "NIV")
        assert canonical == "John 3:16"
        assert "God so loved the world" in text

    def test_unsupported_translation(self):
        """Unsupported translation should raise ValueError."""
        with pytest.raises(ValueError, match="Unsupported translation"):
            get_passage("John 3:16", "INVALID")

    def test_supported_translations_list(self):
        """Verify supported translations list."""
        assert "ESV" in SUPPORTED_TRANSLATIONS
        assert "NIV" in SUPPORTED_TRANSLATIONS
        assert "KJV" in SUPPORTED_TRANSLATIONS

    def test_default_translation(self):
        """Default translation should be ESV."""
        assert DEFAULT_TRANSLATION == "ESV"


class TestTranslationVariety:
    """Test that different translations produce different text."""

    def test_esv_vs_niv(self):
        """ESV and NIV should produce different text."""
        _, esv_text = get_passage("John 3:16", "ESV")
        _, niv_text = get_passage("John 3:16", "NIV")
        # Both should have the core message but different wording
        assert "God so loved" in esv_text
        assert "God so loved" in niv_text
        # ESV uses "only Son", NIV uses "one and only Son"
        # The texts should be different
        assert esv_text != niv_text

    def test_kjv_archaic_language(self):
        """KJV should have archaic language."""
        _, text = get_passage("John 3:16", "KJV")
        # KJV uses "believeth" instead of "believes"
        assert "believeth" in text or "begotten" in text
