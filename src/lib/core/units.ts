/**
 * Splits a verse into the units that cards ask for. Most verses are one unit; only long verses
 * are split, into 2 or 3 parts, at their strongest punctuation, unless the user saved breaks.
 *
 * Words are the lines' texts split on whitespace, numbered from 0 across the whole verse.
 * Selah lines are not counted, never start a unit, and stay with the unit before them.
 */

import type { Break, Line, Unit, Verse } from './model.ts';

/** A verse with more words than this is split. About what can be recited from one prompt. */
export const MAX_WORDS = 30;
/** A verse is never split into more parts than this, however long it is. */
export const MAX_PARTS = 3;
/** Every part of a split verse has at least this many words, so no card asks for a fragment. */
export const MIN_PART_WORDS = 10;

interface Word {
	text: string;
	/** Index of its line in `verse.lines`. */
	line: number;
}

function countedWords(verse: Verse): Word[] {
	const words: Word[] = [];
	verse.lines.forEach((line, i) => {
		if (line.selah) return;
		for (const text of line.text.split(/\s+/)) if (text) words.push({ text, line: i });
	});
	return words;
}

/** The counted words of a verse; `Break.after` indexes into this. */
export function verseWords(verse: Verse): string[] {
	return countedWords(verse).map((w) => w.text);
}

/** The break the editor saves when the user clicks between word `after` and the next one. */
export function breakAfter(verse: Verse, after: number): Break {
	return { after, word: verseWords(verse)[after] };
}

/** How good a place it is to break after word `i`: 4 line end, 3 . ? !, 2 ; : —, 1 comma, 0 none. */
function strength(words: Word[], i: number): number {
	if (words[i + 1].line !== words[i].line) return 4;
	const text = words[i].text.replace(/["'”’)\]»]+$/, ''); // `faith.”` counts as a period
	if (/[.?!]$/.test(text)) return 3;
	if (/[;:—]$/.test(text)) return 2;
	if (/,$/.test(text)) return 1;
	return 0;
}

interface Candidate {
	after: number;
	strength: number;
}

export function autoBreaks(verse: Verse): Break[] {
	const words = countedWords(verse);
	if (words.length <= MAX_WORDS) return [];

	const candidates: Candidate[] = [];
	for (let after = 0; after < words.length - 1; after++) {
		const s = strength(words, after);
		if (s > 0) candidates.push({ after, strength: s });
	}

	for (let parts = Math.min(MAX_PARTS, Math.ceil(words.length / MAX_WORDS)); parts > 1; parts--) {
		const best = bestSplit(candidates, parts - 1, words.length);
		if (best) return best.map(({ after }) => ({ after, word: words[after].text }));
	}
	return [];
}

/** Highest total strength, then closest to even (smallest sum of squared part sizes). */
function bestSplit(candidates: Candidate[], count: number, total: number): Candidate[] | null {
	let best: Candidate[] | null = null;
	let bestStrength = 0;
	let bestSpread = Infinity;
	for (const combo of combinations(candidates, count)) {
		const sizes = partSizes(
			combo.map((c) => c.after),
			total
		);
		if (sizes.some((size) => size < MIN_PART_WORDS)) continue;
		const strength = combo.reduce((sum, c) => sum + c.strength, 0);
		const spread = sizes.reduce((sum, size) => sum + size * size, 0);
		if (strength > bestStrength || (strength === bestStrength && spread < bestSpread)) {
			[best, bestStrength, bestSpread] = [combo, strength, spread];
		}
	}
	return best;
}

/** Every way to pick `count` items, keeping their order. */
function combinations<T>(items: T[], count: number): T[][] {
	if (count === 0) return [[]];
	return items.flatMap((item, i) =>
		combinations(items.slice(i + 1), count - 1).map((rest) => [item, ...rest])
	);
}

/** Word counts of the parts made by breaking after each (ascending) position. */
function partSizes(afters: number[], total: number): number[] {
	const ends = [...afters.map((a) => a + 1), total];
	return ends.map((end, i) => end - (i === 0 ? 0 : ends[i - 1]));
}

/**
 * `saved` undefined: automatic breaks. Empty: one unit. Otherwise the saved breaks, unless any of
 * them no longer matches the text, in which case all are ignored and `stale` is true.
 */
export function splitUnits(verse: Verse, saved?: Break[]): { units: Unit[]; stale: boolean } {
	if (verse.omitted || verse.lines.length === 0) return { units: [], stale: false };

	const words = countedWords(verse);
	const fits = (b: Break) =>
		Number.isInteger(b.after) &&
		b.after >= 0 &&
		b.after < words.length - 1 &&
		words[b.after].text === b.word;
	const stale = saved !== undefined && !saved.every(fits);
	const breaks = saved === undefined || stale ? autoBreaks(verse) : saved;

	const parts = cut(verse.lines, new Set(breaks.map((b) => b.after)));
	const units = parts.map((lines, index) => ({
		verse: verse.ref,
		index,
		count: parts.length,
		lines
	}));
	return { units, stale };
}

/** Groups the lines into parts, splitting a line in two where a break falls inside it. */
function cut(lines: Line[], breaks: Set<number>): Line[][] {
	const parts: Line[][] = [[]];
	let word = 0;
	let pending = false; // a break fell at the end of the previous counted line
	for (const line of lines) {
		if (line.selah) {
			parts[parts.length - 1].push(line);
			continue;
		}
		if (pending) parts.push([]);
		pending = false;

		const tokens = [...line.text.matchAll(/\S+/g)];
		let start = 0; // where the current piece of this line begins
		tokens.forEach((token, j) => {
			if (!breaks.has(word++)) return;
			if (j === tokens.length - 1) {
				pending = true;
				return;
			}
			const text = line.text.slice(start, token.index + token[0].length);
			parts[parts.length - 1].push(piece(line, text, start === 0));
			parts.push([]);
			start = tokens[j + 1].index;
		});
		parts[parts.length - 1].push(start === 0 ? line : piece(line, line.text.slice(start), false));
	}
	return parts;
}

/** Part of a split line. Only the first piece keeps `paragraph`. */
function piece(line: Line, text: string, first: boolean): Line {
	return first && line.paragraph
		? { text, indent: line.indent, paragraph: true }
		: { text, indent: line.indent };
}
