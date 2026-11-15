/**
 * Turns a deck's passages into notes: one note per unit, each asked exactly once.
 * The front shows the reference and the previous unit as a lead-in; the back shows the unit.
 * Note identity comes from deck id, translation, verse and unit index, never from text.
 */

import { BOOKS, isSingleChapter } from './books.ts';
import { revisionTag } from './diff.ts';
import type {
	DeckDefinition,
	NoteSpec,
	Passage,
	RefRange,
	TranslationId,
	Unit,
	VerseRef
} from './model.ts';
import { verseKey } from './refs.ts';
import { firstLetters, renderLines } from './render.ts';
import { TRANSLATIONS } from './translations.ts';
import { splitUnits } from './units.ts';

const BOOK_NAMES = new Map(BOOKS.map((book) => [book.id, book.name]));

export function noteGuid(
	deckId: string,
	translation: TranslationId,
	verse: VerseRef,
	unitIndex: number
): string {
	return `bm1:${deckId}:${translation}:${verseKey(verse)}:${unitIndex}`;
}

/** "John 3:16"; "Jude 5" but "Jude 1:1", as in refs.ts labels. */
export function verseLabel(ref: VerseRef): string {
	const name = BOOK_NAMES.get(ref.book) ?? ref.book;
	if (isSingleChapter(ref.book) && ref.verse !== 1) return `${name} ${ref.verse}`;
	return `${name} ${ref.chapter}:${ref.verse}`;
}

/**
 * `passages` are in deck order. A verse that appears in more than one passage makes notes only
 * the first time, because GUIDs must be unique within a deck; later copies still serve as the
 * lead-in for the verse after them.
 */
export function makeNotes(
	def: DeckDefinition,
	passages: Passage[]
): { notes: NoteSpec[]; staleBreaks: string[] } {
	const notes: NoteSpec[] = [];
	const staleBreaks: string[] = [];
	const done = new Set<string>();
	const tags = [revisionTag(def)];
	const short = TRANSLATIONS[def.translation].short;

	for (const passage of passages) {
		// The lead-in only runs within one range: "John 14:1-3, 6" gives verse 6 none.
		let previous: { unit: Unit; range: number } | null = null;
		for (const verse of passage.verses) {
			if (verse.omitted) previous = null; // nothing to lead in from across the gap
			const key = verseKey(verse.ref);
			const range = rangeIndex(passage.ref.ranges, verse.ref);
			const isNew = !done.has(key);
			done.add(key);
			const { units, stale } = splitUnits(verse, def.breaks[key]);
			if (isNew && stale) staleBreaks.push(key);

			for (const unit of units) {
				const lead = previous?.range === range ? previous.unit : null;
				previous = { unit, range };
				if (!isNew) continue;

				const part = unit.count > 1 ? ` (${unit.index + 1}/${unit.count})` : '';
				let context = '';
				if (lead) context = renderUnit(lead);
				else if (verse.title) context = renderLines([{ text: verse.title, indent: 0 }]);

				notes.push({
					guid: noteGuid(def.id, def.translation, verse.ref, unit.index),
					order: notes.length,
					tags,
					fields: {
						Reference: verseLabel(verse.ref) + part,
						Context: context,
						Answer: renderUnit(unit),
						Hint: firstLetters(unit.lines),
						Info: `${passage.ref.label} · ${short}`
					}
				});
			}
		}
	}
	return { notes, staleBreaks };
}

/** A unit's lines, with the verse-number marker when it is the first unit of its verse. */
function renderUnit(unit: Unit): string {
	return renderLines(unit.lines, unit.index === 0 ? unit.verse.verse : undefined);
}

/** Which of the passage's ranges holds the verse, or -1. */
function rangeIndex(ranges: RefRange[], ref: VerseRef): number {
	const at = (v: VerseRef) => v.chapter * 1000 + v.verse; // verses per chapter stay under 1000
	return ranges.findIndex((r) => at(r.start) <= at(ref) && at(ref) <= at(r.end));
}
