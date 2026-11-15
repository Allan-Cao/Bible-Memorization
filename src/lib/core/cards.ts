/**
 * Turns a deck's passages into cards and notes: one per unit, each asked exactly once.
 * The front shows the reference and the previous unit as a lead-in; the back shows the unit.
 * Note identity comes from deck id, translation, verse and unit index, never from text.
 */

import { revisionTag } from './diff.ts';
import type {
	Break,
	DeckDefinition,
	Line,
	NoteSpec,
	Passage,
	TranslationId,
	Unit,
	Verse,
	VerseRef
} from './model.ts';
import { inRange, verseKey, verseLabel } from './refs.ts';
import { firstLetters, renderLines } from './render.ts';
import { TRANSLATIONS } from './translations.ts';
import { splitUnits } from './units.ts';

export function noteGuid(
	deckId: string,
	translation: TranslationId,
	verse: VerseRef,
	unitIndex: number
): string {
	return `bm1:${deckId}:${translation}:${verseKey(verse)}:${unitIndex}`;
}

/** What a card shows dimmed above the prompt: the previous unit, or a psalm title (`title`). */
export interface Lead {
	lines: Line[];
	/** Set when the lines start a verse. */
	verseNumber?: number;
	title: boolean;
}

export interface PlannedCard {
	/** As on the card, e.g. "John 3:16 (1/2)". */
	reference: string;
	unit: Unit;
	lead: Lead | null;
}

export interface PlannedVerse {
	verse: Verse;
	key: string;
	/** Asked by an earlier passage, so it makes no cards here. */
	repeated: boolean;
	/** The saved breaks no longer match the text, so the automatic ones are in use. */
	stale: boolean;
	/** The breaks in use, saved or automatic. */
	breaks: Break[];
	/** Empty when the verse is omitted or repeated. */
	cards: PlannedCard[];
}

/**
 * Decides every card of a deck, as data: one list of verses per passage, in deck order. Both the
 * notes (makeNotes) and the editor's preview (editor.ts) are made from this.
 *
 * A verse that appears in more than one passage makes cards only the first time, because GUIDs
 * must be unique within a deck; later copies still serve as the lead-in for the verse after them.
 */
export function planCards(breaks: DeckDefinition['breaks'], passages: Passage[]): PlannedVerse[][] {
	const done = new Set<string>();
	return passages.map((passage) => {
		// The lead-in only runs within one range: "John 14:1-3, 6" gives verse 6 none.
		let previous: { unit: Unit; range: number } | null = null;
		return passage.verses.map((verse): PlannedVerse => {
			if (verse.omitted) previous = null; // nothing to lead in from across the gap
			const key = verseKey(verse.ref);
			const range = passage.ref.ranges.findIndex((r) => inRange(r, verse.ref));
			const repeated = done.has(key);
			done.add(key);
			const split = splitUnits(verse, breaks[key]);

			const cards: PlannedCard[] = [];
			for (const unit of split.units) {
				const lead = previous?.range === range ? previous.unit : null;
				previous = { unit, range };
				if (repeated) continue;
				const part = unit.count > 1 ? ` (${unit.index + 1}/${unit.count})` : '';
				cards.push({
					reference: verseLabel(verse.ref) + part,
					unit,
					lead: leadIn(verse, unit, lead)
				});
			}
			return { verse, key, repeated, stale: split.stale, breaks: split.breaks, cards };
		});
	});
}

function leadIn(verse: Verse, unit: Unit, previous: Unit | null): Lead | null {
	if (verse.title && unit.index === 0) {
		return { lines: [{ text: verse.title, indent: 0 }], title: true };
	}
	if (!previous) return null;
	// Selah is not worth recalling, so it never leads in.
	const lines = previous.lines.filter((line) => !line.selah);
	if (lines.length === 0) return null;
	return { lines, verseNumber: firstVerseNumber(previous), title: false };
}

/** The verse number a unit's lines start with: only a verse's first unit has one. */
export function firstVerseNumber(unit: Unit): number | undefined {
	return unit.index === 0 ? unit.verse.verse : undefined;
}

export function makeNotes(
	def: DeckDefinition,
	passages: Passage[]
): { notes: NoteSpec[]; staleBreaks: string[] } {
	const notes: NoteSpec[] = [];
	const staleBreaks: string[] = [];
	const tags = [revisionTag(def)];
	const short = TRANSLATIONS[def.translation].short;

	planCards(def.breaks, passages).forEach((verses, i) => {
		for (const { verse, key, repeated, stale, cards } of verses) {
			if (stale && !repeated) staleBreaks.push(key);
			for (const { reference, unit, lead } of cards) {
				notes.push({
					guid: noteGuid(def.id, def.translation, verse.ref, unit.index),
					order: notes.length,
					tags,
					fields: {
						Reference: reference,
						Context: lead ? renderLines(lead.lines, lead.verseNumber) : '',
						Answer: renderLines(unit.lines, firstVerseNumber(unit)),
						Hint: firstLetters(unit.lines),
						Info: `${passages[i].ref.label} · ${short}`
					}
				});
			}
		}
	});
	return { notes, staleBreaks };
}
