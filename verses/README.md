# Verse Lists

Text files containing verse references for memorization. One verse per line, `#` for comments.

## Files

| File | Description | Source |
|------|-------------|--------|
| `ot.txt` | 25 Old Testament passages | `image.png` |
| `nt.txt` | 18 New Testament passages | `image.png` |
| `tms.txt` | 60 Topical Memory System verses | The Navigators (`TMS.pdf`) |
| `nathan.txt` | 34 curated memory verses | Nathan's list |
| `mohammed.txt` | James + John (26 chapters) | Mohammed's list |

## Usage

```bash
uv run bible-memorization verses/tms.txt -o tms_deck.apkg
uv run bible-memorization verses/nathan.txt -t NIV -o nathan_niv.apkg
```

## Format

```
# Comment lines start with #
John 3:16
Psalm 23
Romans 8:28-39
```

## Sources

- `image.png` - OT/NT verse list photograph
- `TMS.pdf` - The Navigators Topical Memory System
