/**
 * What the deck editor shows: every card of a build, grouped by heading, passage and verse, as
 * Unit/Line data rather than note HTML. Plus the small edits the editor makes (breaks) and the
 * export note about passages inserted among cards Anki already has.
 *
 * The walk mirrors makeNotes in cards.ts (lead-in within one range, reset at an omitted verse,
 * psalm title on a verse's first unit, Selah never leading in, each verse asked once).
 * editor.test.ts checks the two agree card for card, so a change there shows up here.
 */

import type { BuildResult } from './build.ts';
import type { Break, DeckDefinition, Line, Unit, Verse } from './model.ts';
import { inRange, verseKey } from './refs.ts';
import { firstLetters } from './render.ts';
import { autoBreaks, breakAfter, splitUnits, verseWords } from './units.ts';

export interface PreviewCard {
	/** As on the card, e.g. "John 3:16 (1/2)". */
	reference: string;
	/** Shown dimmed above the prompt: the previous verse, or a psalm title (`title`). */
	lead: { lines: Line[]; verseNumber?: number; title: boolean } | null;
	unit: Unit;
	/** The verse number shown at the start of the answer, on a verse's first unit only. */
	verseNumber?: number;
	hint: Line[];
}

export interface PreviewVerse {
	verse: Verse;
	key: string;
	/** Empty when the verse is omitted or already asked by an earlier passage. */
	cards: PreviewCard[];
	/** Asked by an earlier passage, so it makes no cards here. */
	repeated: boolean;
	/** The breaks in use, saved or automatic. */
	breaks: Break[];
	/** The verse uses breaks the user saved. */
	saved: boolean;
}

export interface PreviewPassage {
	label: string;
	verses: PreviewVerse[];
	cards: number;
}

export interface PreviewGroup {
	heading: string | null;
	passages: PreviewPassage[];
}

export function previewDeck(def: DeckDefinition, result: BuildResult): PreviewGroup[] {
	const notes = result.build.notes;
	const done = new Set<string>();
	let next = 0; // index of the note the next new card corresponds to
	let at = 0; // index into result.passages; groups list their refs in the same order

	return result.groups.map((group) => ({
		heading: group.heading,
		passages: group.refs.map(() => {
			const passage = result.passages[at++];
			let previous: { unit: Unit; range: number } | null = null;
			const verses = passage.verses.map((verse): PreviewVerse => {
				if (verse.omitted) previous = null;
				const key = verseKey(verse.ref);
				const range = passage.ref.ranges.findIndex((r) => inRange(r, verse.ref));
				const repeated = done.has(key);
				done.add(key);
				const saved = def.breaks[key];
				const { units, stale } = splitUnits(verse, saved);
				const cards: PreviewCard[] = [];
				for (const unit of units) {
					const lead = previous?.range === range ? previous.unit : null;
					previous = { unit, range };
					if (repeated) continue;
					cards.push({
						reference: notes[next++].fields.Reference,
						lead: leadIn(verse, unit, lead),
						unit,
						verseNumber: unit.index === 0 ? verse.ref.verse : undefined,
						hint: hintLines(unit.lines)
					});
				}
				const useSaved = saved !== undefined && !stale;
				return {
					verse,
					key,
					cards,
					repeated,
					breaks: useSaved ? saved : autoBreaks(verse),
					saved: useSaved
				};
			});
			return {
				label: passage.ref.label,
				verses,
				cards: verses.reduce((n, v) => n + v.cards.length, 0)
			};
		})
	}));
}

function leadIn(verse: Verse, unit: Unit, lead: Unit | null): PreviewCard['lead'] {
	if (verse.title && unit.index === 0) {
		return { lines: [{ text: verse.title, indent: 0 }], title: true };
	}
	if (!lead) return null;
	const lines = lead.lines.filter((line) => !line.selah);
	if (lines.length === 0) return null;
	return { lines, verseNumber: lead.index === 0 ? lead.verse.verse : undefined, title: false };
}

/** Adds a break after word `after`, or removes the one there. Kept in word order. */
export function toggleBreak(verse: Verse, breaks: Break[], after: number): Break[] {
	if (!Number.isInteger(after) || after < 0 || after >= verseWords(verse).length - 1) return breaks;
	if (breaks.some((b) => b.after === after)) return breaks.filter((b) => b.after !== after);
	return [...breaks, breakAfter(verse, after)].sort((a, b) => a.after - b.after);
}

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"' };

/**
 * The first-letter hint as lines, Selah left out, the same text as the Hint field.
 * Takes the text from firstLetters one line at a time; render.ts has no per-line export yet.
 */
export function hintLines(lines: Line[]): Line[] {
	return lines
		.filter((line) => !line.selah)
		.map((line) => {
			const html = firstLetters([{ text: line.text, indent: 0 }]);
			const text = html
				.replace(/^<div class="line">|<\/div>$/g, '')
				.replace(/&(amp|lt|gt|quot);/g, (e) => ENTITIES[e]);
			return { ...line, text };
		});
}

/**
 * Passages added since the last export that come before a passage exported then. Anki keeps the
 * order of cards it already has, so the new cards will not come up in list order.
 */
export function insertedPassages(previous: string[] | null, next: string[]): string[] {
	if (!previous) return [];
	const old = new Set(previous);
	let lastOld = -1;
	next.forEach((label, i) => {
		if (old.has(label)) lastOld = i;
	});
	return next.filter((label, i) => !old.has(label) && i < lastOld);
}
