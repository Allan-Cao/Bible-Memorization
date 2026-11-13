"""Pytest configuration and shared fixtures."""

from functools import lru_cache

import pytest


@lru_cache(maxsize=128)
def _cached_get_passage(verse_ref: str, translation: str = "ESV") -> tuple:
    """Cache passage fetches to avoid repeated network calls."""
    from bible_memorization.clients import get_passage

    return get_passage(verse_ref, translation)


@pytest.fixture(scope="session")
def passage_cache():
    """Session-scoped fixture providing cached passage fetches."""
    return _cached_get_passage
