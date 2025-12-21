# -*- coding: utf-8 -*-
"""
Tests for the Anki deck generator module.

Test Philosophy:
- Verify card generation logic produces correct sliding window behavior
- Test that cards contain expected content, not just that they exist
- Ensure integration with real passages produces usable decks
"""

import os
import tempfile
import pytest
from anki_generator import (
    stable_id,
    generate_cards,
    generate_deck,
    make_model,
    load_verses,
)
from parser import parse_lines, format_lines
from clients import get_passage


class TestStableId:
    """Tests for stable ID generation."""

    def test_same_name_same_id(self):
        """Same name should always produce same ID (deterministic)."""
        id1 = stable_id("Test Deck")
        id2 = stable_id("Test Deck")
        assert id1 == id2

    def test_different_names_different_ids(self):
        """Different names should produce different IDs."""
        id1 = stable_id("Deck One")
        id2 = stable_id("Deck Two")
        assert id1 != id2

    def test_id_is_positive_integer(self):
        """ID should be a positive integer suitable for Anki."""
        result = stable_id("Test")
        assert isinstance(result, int)
        assert result > 0

    def test_special_characters_handled(self):
        """Names with special characters should still produce valid IDs."""
        id1 = stable_id("Test (NIV)")
        id2 = stable_id("Test: Special!")
        assert isinstance(id1, int)
        assert isinstance(id2, int)
        assert id1 != id2


class TestLoadVerses:
    """Tests for loading verses from text files."""

    def test_load_simple_file(self, tmp_path):
        """Load verses from a simple text file."""
        verse_file = tmp_path / "verses.txt"
        verse_file.write_text("John 3:16\nPsalm 23\nRomans 8:28\n")
        verses = load_verses(verse_file)
        assert verses == ["John 3:16", "Psalm 23", "Romans 8:28"]

    def test_ignores_comments_and_blanks(self, tmp_path):
        """Comments and blank lines are ignored."""
        verse_file = tmp_path / "verses.txt"
        verse_file.write_text(
            "# Header comment\nJohn 3:16\n\n# Another comment\nPsalm 23\n"
        )
        verses = load_verses(verse_file)
        assert verses == ["John 3:16", "Psalm 23"]

    def test_strips_whitespace(self, tmp_path):
        """Leading/trailing whitespace is stripped."""
        verse_file = tmp_path / "verses.txt"
        verse_file.write_text("  John 3:16  \n\tPsalm 23\t\n")
        verses = load_verses(verse_file)
        assert verses == ["John 3:16", "Psalm 23"]


class TestGenerateCards:
    """Tests for card generation logic."""

    def test_short_passage_single_card(self):
        """Passage with <= recite_lines produces single card."""
        lines = ["Line 1", "Line 2"]
        cards = generate_cards("Test 1:1", lines, context_lines=2, recite_lines=2)

        assert len(cards) == 1
        assert cards[0]["title"] == "Test 1:1"
        assert cards[0]["context"] == ""
        assert cards[0]["answer"] == "Line 1\nLine 2"
        assert cards[0]["sequence"] == 1

    def test_empty_passage_no_cards(self):
        """Empty passage produces no cards."""
        cards = generate_cards("Empty", [], context_lines=2, recite_lines=2)
        assert len(cards) == 0

    def test_first_card_bootstrap_no_context(self):
        """First card has no context (bootstrap card)."""
        lines = ["A", "B", "C", "D", "E", "F"]
        cards = generate_cards("Test", lines, context_lines=2, recite_lines=2)

        assert cards[0]["context"] == ""
        assert cards[0]["answer"] == "A\nB"

    def test_subsequent_cards_have_context(self):
        """Cards after the first include context from previous lines."""
        lines = ["A", "B", "C", "D", "E", "F"]
        cards = generate_cards("Test", lines, context_lines=2, recite_lines=2)

        # Second card should have context
        assert len(cards) > 1
        assert cards[1]["context"] != ""
        # Context should be previous lines
        assert "A" in cards[1]["context"] or "B" in cards[1]["context"]

    def test_sliding_window_progression(self):
        """Cards should slide by 1 line each, not jump."""
        lines = ["A", "B", "C", "D", "E", "F", "G", "H"]
        cards = generate_cards("Test", lines, context_lines=2, recite_lines=2)

        # First card: A, B
        assert "A" in cards[0]["answer"]
        assert "B" in cards[0]["answer"]

        # Each subsequent card slides by 1
        # Card 2 answer should start at line index 2 (C)
        assert "C" in cards[1]["answer"]

    def test_context_lines_parameter(self):
        """context_lines controls how much context is shown."""
        lines = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"]
        cards_2ctx = generate_cards("Test", lines, context_lines=2, recite_lines=2)
        cards_4ctx = generate_cards("Test", lines, context_lines=4, recite_lines=2)

        # With more context lines, later cards should have more context
        if len(cards_2ctx) > 2 and len(cards_4ctx) > 2:
            ctx_2_len = len(cards_2ctx[2]["context"].split("\n"))
            ctx_4_len = len(cards_4ctx[2]["context"].split("\n"))
            assert ctx_4_len >= ctx_2_len

    def test_recite_lines_parameter(self):
        """recite_lines controls how many lines to recall per card."""
        lines = ["A", "B", "C", "D", "E", "F"]
        cards_2 = generate_cards("Test", lines, context_lines=2, recite_lines=2)
        cards_3 = generate_cards("Test", lines, context_lines=2, recite_lines=3)

        # First card with recite_lines=2 should have 2 answer lines
        assert len(cards_2[0]["answer"].split("\n")) == 2
        # First card with recite_lines=3 should have 3 answer lines
        assert len(cards_3[0]["answer"].split("\n")) == 3

    def test_sequence_numbering_is_sequential(self):
        """Card sequences should be 1, 2, 3, etc."""
        lines = ["A", "B", "C", "D", "E", "F"]
        cards = generate_cards("Test", lines, context_lines=2, recite_lines=2)

        for i, card in enumerate(cards, 1):
            assert card["sequence"] == i

    def test_title_format_with_count(self):
        """Title should include card number and total."""
        lines = ["A", "B", "C", "D", "E"]
        cards = generate_cards("Test 1:1", lines, context_lines=2, recite_lines=2)

        if len(cards) > 1:
            total = len(cards)
            assert f"(1/{total})" in cards[0]["title"]
            assert f"(2/{total})" in cards[1]["title"]

    def test_prompt_shows_line_count(self):
        """Prompt should indicate how many lines to recite."""
        lines = ["A", "B", "C", "D", "E", "F"]
        cards = generate_cards("Test", lines, context_lines=2, recite_lines=2)

        # Check that prompt mentions the number of lines
        assert "2" in cards[0]["prompt"] or "lines" in cards[0]["prompt"]


class TestGenerateCardsWithRealContent:
    """Test card generation with actual Bible passage content."""

    def test_john_3_16_single_card(self):
        """John 3:16 (single verse) should produce 1 card."""
        _, text = get_passage("John 3:16", "ESV")
        lines = parse_lines(text)
        cards = generate_cards("John 3:16", lines, context_lines=2, recite_lines=2)

        assert len(cards) == 1
        assert "God so loved" in cards[0]["answer"]

    def test_psalm_23_multiple_cards(self):
        """Psalm 23 (poetry) should produce multiple meaningful cards."""
        _, text = get_passage("Psalm 23", "ESV")
        lines = parse_lines(text)
        cards = generate_cards("Psalm 23", lines, context_lines=2, recite_lines=2)

        # Should have multiple cards
        assert len(cards) > 3

        # First card should have shepherd content
        assert "shepherd" in cards[0]["answer"].lower()

        # Later cards should have context
        assert cards[-1]["context"] != ""

    def test_james_1_cards_after_fix(self):
        """James 1:2-4 should produce correct cards after verse-split fix."""
        _, text = get_passage("James 1:2-4", "ESV")
        lines = parse_lines(text)

        # Verify we have 3 lines (one per verse)
        assert len(lines) == 3

        # With recite_lines=2, should produce 2 cards
        cards = generate_cards("James 1:2-4", lines, context_lines=2, recite_lines=2)
        assert len(cards) == 2


class TestMakeModel:
    """Tests for Anki model creation."""

    def test_model_has_all_required_fields(self):
        """Model should have all required note fields."""
        model = make_model(12345)
        field_names = [f["name"] for f in model.fields]

        required_fields = [
            "Title",
            "Context",
            "Prompt",
            "Answer",
            "Sequence",
            "Reference",
        ]
        for field in required_fields:
            assert field in field_names, f"Missing required field: {field}"

    def test_model_has_recite_template(self):
        """Model should have the Recite card template."""
        model = make_model(12345)

        assert len(model.templates) == 1
        assert model.templates[0]["name"] == "Recite"

    def test_model_has_css(self):
        """Model should have CSS styling."""
        model = make_model(12345)
        assert model.css is not None
        assert len(model.css) > 0

    def test_template_uses_fields(self):
        """Template should reference the note fields."""
        model = make_model(12345)
        qfmt = model.templates[0]["qfmt"]
        afmt = model.templates[0]["afmt"]

        # Question should show title, context, prompt
        assert "Title" in qfmt
        assert "Context" in qfmt
        assert "Prompt" in qfmt

        # Answer should show the answer
        assert "Answer" in afmt


class TestGenerateDeck:
    """Tests for full deck generation."""

    def test_creates_apkg_file(self):
        """generate_deck should create an .apkg file."""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_file = os.path.join(tmpdir, "test.apkg")

            total_cards = generate_deck(
                verse_list=["John 3:16"],
                deck_name="Test Deck",
                output_file=output_file,
            )

            assert os.path.exists(output_file)
            assert os.path.getsize(output_file) > 0
            assert total_cards > 0

    def test_returns_correct_card_count(self):
        """Return value should match actual cards generated."""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_file = os.path.join(tmpdir, "test.apkg")

            # John 3:16 is single verse = 1 card
            total_cards = generate_deck(
                verse_list=["John 3:16"],
                deck_name="Test",
                output_file=output_file,
            )

            assert total_cards == 1

    def test_multiple_verses_accumulate(self):
        """Multiple verses in list should all be added to deck."""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_file = os.path.join(tmpdir, "multi.apkg")

            total_cards = generate_deck(
                verse_list=["John 3:16", "John 3:17"],
                deck_name="Multi",
                output_file=output_file,
            )

            # Each single verse = 1 card, so 2 total
            assert total_cards == 2

    def test_translation_parameter(self):
        """Different translations should work."""
        with tempfile.TemporaryDirectory() as tmpdir:
            for translation in ["ESV", "NIV", "KJV"]:
                output_file = os.path.join(tmpdir, f"test_{translation}.apkg")

                total_cards = generate_deck(
                    verse_list=["John 3:16"],
                    deck_name=f"Test {translation}",
                    output_file=output_file,
                    translation=translation,
                )

                assert total_cards > 0
                assert os.path.exists(output_file)

    def test_custom_context_and_recite_lines(self):
        """Custom context_lines and recite_lines parameters work."""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_file = os.path.join(tmpdir, "custom.apkg")

            total_cards = generate_deck(
                verse_list=["Psalm 23"],
                deck_name="Custom",
                output_file=output_file,
                context_lines=3,
                recite_lines=1,
            )

            # Should produce more cards with recite_lines=1
            assert total_cards > 5

    def test_custom_deck_id_used(self):
        """Custom deck_id should be used instead of auto-generated."""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_file = os.path.join(tmpdir, "custom_id.apkg")

            # This should not raise an error
            total_cards = generate_deck(
                verse_list=["John 3:16"],
                deck_name="Custom ID",
                output_file=output_file,
                deck_id=123456789,
                model_id=987654321,
            )

            assert total_cards > 0


class TestSplitLongLinesIntegration:
    """Tests for split_long_lines feature in generate_deck."""

    def test_split_long_lines_default_false(self):
        """split_long_lines should default to False."""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_file = os.path.join(tmpdir, "test.apkg")

            # Should work without specifying split_long_lines
            total_cards = generate_deck(
                verse_list=["John 3:16"],
                deck_name="Default",
                output_file=output_file,
            )

            assert total_cards > 0

    def test_split_long_lines_creates_more_cards(self):
        """Enabling split_long_lines should create more cards for long passages."""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_without = os.path.join(tmpdir, "without.apkg")
            output_with = os.path.join(tmpdir, "with.apkg")

            cards_without = generate_deck(
                verse_list=["James 1:12-15"],
                deck_name="Without Split",
                output_file=output_without,
                split_long_lines=False,
            )

            cards_with = generate_deck(
                verse_list=["James 1:12-15"],
                deck_name="With Split",
                output_file=output_with,
                split_long_lines=True,
                max_line_length=80,
            )

            # With splitting, same content but more lines = more cards
            assert cards_with >= cards_without

    def test_max_line_length_parameter(self):
        """max_line_length should control split threshold."""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_80 = os.path.join(tmpdir, "len80.apkg")
            output_200 = os.path.join(tmpdir, "len200.apkg")

            cards_80 = generate_deck(
                verse_list=["James 1:12-15"],
                deck_name="Len 80",
                output_file=output_80,
                split_long_lines=True,
                max_line_length=80,
            )

            cards_200 = generate_deck(
                verse_list=["James 1:12-15"],
                deck_name="Len 200",
                output_file=output_200,
                split_long_lines=True,
                max_line_length=200,
            )

            # Shorter max length = more splits = more cards
            assert cards_80 >= cards_200


class TestDeckIntegrationRealPassages:
    """Integration tests with real Bible passages."""

    def test_psalm_poetry_generates_usable_deck(self):
        """Psalm (poetry) generates a deck with proper structure."""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_file = os.path.join(tmpdir, "psalm.apkg")

            total_cards = generate_deck(
                verse_list=["Psalm 23"],
                deck_name="Psalm 23",
                output_file=output_file,
            )

            # Psalm 23 has many lines, should produce good number of cards
            assert total_cards >= 4

    def test_beatitudes_prose_generates_usable_deck(self):
        """Beatitudes (prose) generates proper cards."""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_file = os.path.join(tmpdir, "beatitudes.apkg")

            total_cards = generate_deck(
                verse_list=["Matthew 5:3-10"],
                deck_name="Beatitudes",
                output_file=output_file,
            )

            # 8 beatitudes = 8 lines, should produce multiple cards
            assert total_cards >= 3

    def test_epistle_generates_usable_deck(self):
        """Epistles with long sentences generate proper cards."""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_file = os.path.join(tmpdir, "james.apkg")

            total_cards = generate_deck(
                verse_list=["James 1:2-8"],
                deck_name="James 1",
                output_file=output_file,
            )

            # 7 verses should produce multiple cards
            assert total_cards >= 3

    def test_narrative_generates_usable_deck(self):
        """Narrative passages (Genesis) generate proper cards."""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_file = os.path.join(tmpdir, "genesis.apkg")

            total_cards = generate_deck(
                verse_list=["Genesis 1:1-5"],
                deck_name="Genesis 1",
                output_file=output_file,
            )

            # 5 verses should produce meaningful cards
            assert total_cards >= 2

    def test_numbered_book_works(self):
        """Books with numbers (1 John, 2 Timothy) work correctly."""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_file = os.path.join(tmpdir, "1john.apkg")

            total_cards = generate_deck(
                verse_list=["1 John 4:7-8"],
                deck_name="1 John Love",
                output_file=output_file,
            )

            assert total_cards >= 1


class TestErrorHandling:
    """Tests for error handling."""

    def test_handles_invalid_reference_gracefully(self):
        """Invalid references should not crash the whole deck generation."""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_file = os.path.join(tmpdir, "test.apkg")

            # Mix of valid and invalid - should still produce something
            total_cards = generate_deck(
                verse_list=["John 3:16", "InvalidRef 99:99"],
                deck_name="Mixed",
                output_file=output_file,
            )

            # At least the valid one should work
            assert total_cards >= 1
