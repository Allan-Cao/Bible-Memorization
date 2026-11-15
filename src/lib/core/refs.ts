/**
 * Strict parsing of one reference ("John 14:1-3, 6") into verse ranges plus a normalized label.
 *
 * Grammar, after the book name (spaces around `:` `-` `,` are optional, `.` may replace `:`):
 *   item  = C | C-C | C:V | C:V-V | C:V-C:V        (the first item)
 *   later = V | V-V | C:V | C:V-V | C:V-C:V         (after a comma; a bare number is a verse)
 * A bare number in the first item is a whole chapter, except in single-chapter books
 * (Jude 5 is verse 5; Jude 1 is the whole book).
 *
 * Label rules: full book name, `:` and `-`, items joined by ", ". A first item that covers whole
 * chapters is written as chapters ("Psalm 23", "Psalm 1-2"). Later items drop the chapter when it
 * equals the previous item's last chapter. Single-chapter books never show the chapter ("Jude 5"),
 * except a lone verse 1, which is "Jude 1:1" because "Jude 1" means the whole book.
 * Items keep the order they were typed in.
 */

import { findBook, isSingleChapter } from './books.ts';
import type { RefRange, Reference, VerseRef, Versification } from './model.ts';

/** C or V, then optionally -C or -V, with an optional :V after either number. */
const ITEM = /^(\d+)(?::(\d+))?(?:-(\d+)(?::(\d+))?)?$/;

export function parseReference(input: string, versification: Versification): Reference {
	const text = input.trim().replace(/[–—]/g, '-').replace(/\s+/g, ' ');
	if (!text) throw new Error('Empty reference');

	// Book name: an optional leading digit, then everything up to the first other digit.
	const split = /^((?:\d\s*)?[^\d]+?)\s*(\d.*)?$/.exec(text);
	const book = split && findBook(split[1]);
	if (!split || !book) throw new Error(`Unknown book "${split ? split[1] : text}"`);
	if (split[2] === undefined)
		throw new Error(`${book.name} needs a chapter, e.g. "${book.name} 1"`);
	const counts = versification[book.id];
	if (!counts) throw new Error(`No verse data for ${book.name}`);

	const spec = split[2].replace(/(\d)\s*\.\s*(\d)/g, '$1:$2').replace(/\s*([:,-])\s*/g, '$1');

	const ranges: RefRange[] = [];
	let chapter = 0; // the chapter a bare verse number refers to
	for (const item of spec.split(',')) {
		const range = parseItem(item, book.id, book.name, counts, ranges.length === 0, chapter);
		ranges.push(range);
		chapter = range.end.chapter;
	}

	rejectOverlaps(ranges, counts, book.name);

	let current: number | null = null;
	const items = ranges.map((range, i) => {
		const label = itemLabel(range, counts, i === 0, current);
		current = range.end.chapter;
		return label;
	});
	return { label: `${book.name} ${items.join(', ')}`, ranges };
}

function parseItem(
	item: string,
	book: string,
	name: string,
	counts: number[],
	first: boolean,
	chapter: number
): RefRange {
	const m = ITEM.exec(item);
	if (!m || (m[2] === undefined && m[4] !== undefined)) {
		throw new Error(`Unexpected text in "${item}"`);
	}
	const [a, b, c, d] = m.slice(1).map((s) => (s === undefined ? undefined : Number(s)));

	let sc: number, sv: number, ec: number, ev: number;
	if (b !== undefined) {
		// C:V, C:V-V or C:V-C:V
		[sc, sv] = [a!, b];
		[ec, ev] = d !== undefined ? [c!, d] : [sc, c ?? b];
	} else if (first && !isSingleChapter(book)) {
		// Whole chapters: C or C-C
		[sc, ec] = [a!, c ?? a!];
		checkChapter(sc, name, counts);
		checkChapter(ec, name, counts);
		[sv, ev] = [1, counts[ec - 1]];
	} else if (first && a === 1 && c === undefined) {
		// "Jude 1" is the whole single-chapter book
		[sc, sv, ec, ev] = [1, 1, 1, counts[0]];
	} else {
		// Bare verses: V or V-V, in the single chapter or the current chapter
		[sc, sv, ec, ev] = [first ? 1 : chapter, a!, first ? 1 : chapter, c ?? a!];
	}

	checkChapter(sc, name, counts);
	checkChapter(ec, name, counts);
	checkVerse(sc, sv, name, counts);
	checkVerse(ec, ev, name, counts);
	if (sc > ec || (sc === ec && sv > ev)) {
		throw new Error(`"${item}" is a reversed range: the start must come before the end`);
	}
	return { start: { book, chapter: sc, verse: sv }, end: { book, chapter: ec, verse: ev } };
}

function checkChapter(chapter: number, name: string, counts: number[]): void {
	if (chapter === 0) throw new Error('Chapter 0 does not exist; chapters start at 1');
	if (chapter > counts.length) {
		const has = counts.length === 1 ? '1 chapter' : `${counts.length} chapters`;
		throw new Error(`${name} has ${has}, so chapter ${chapter} does not exist`);
	}
}

function checkVerse(chapter: number, verse: number, name: string, counts: number[]): void {
	if (verse === 0) throw new Error('Verse 0 does not exist; verses start at 1');
	const last = counts[chapter - 1];
	if (verse > last) {
		const where = counts.length === 1 ? name : `${name} ${chapter}`;
		throw new Error(`${where} has ${last} verses, so verse ${verse} does not exist`);
	}
}

/** Position of a verse counted from the start of the book, so adjacent chapters compare correctly. */
function ordinal(v: VerseRef, counts: number[]): number {
	let n = v.verse;
	for (let i = 0; i < v.chapter - 1; i++) n += counts[i];
	return n;
}

function rejectOverlaps(ranges: RefRange[], counts: number[], name: string): void {
	for (let i = 0; i < ranges.length; i++) {
		for (let j = i + 1; j < ranges.length; j++) {
			const [a, b] = [ranges[i], ranges[j]];
			if (
				ordinal(a.start, counts) <= ordinal(b.end, counts) + 1 &&
				ordinal(b.start, counts) <= ordinal(a.end, counts) + 1
			) {
				const text = (r: RefRange) => `${name} ${itemLabel(r, counts, false, null)}`;
				throw new Error(`${text(a)} and ${text(b)} overlap or touch; write them as one range`);
			}
		}
	}
}

/** One comma-separated piece of the label. `current` is the previous item's last chapter, or null. */
function itemLabel(
	range: RefRange,
	counts: number[],
	first: boolean,
	current: number | null
): string {
	const { start, end } = range;
	if (first && start.verse === 1 && end.verse === counts[end.chapter - 1]) {
		return start.chapter === end.chapter ? `${start.chapter}` : `${start.chapter}-${end.chapter}`;
	}
	if (start.chapter !== end.chapter) {
		return `${start.chapter}:${start.verse}-${end.chapter}:${end.verse}`;
	}
	const verses = start.verse === end.verse ? `${start.verse}` : `${start.verse}-${end.verse}`;
	const loneFirstVerse = start.verse === 1 && end.verse === 1;
	const bare = isSingleChapter(start.book) ? !(first && loneFirstVerse) : start.chapter === current;
	return bare ? verses : `${start.chapter}:${verses}`;
}

/** "JHN.3.16" */
export function verseKey(ref: VerseRef): string {
	return `${ref.book}.${ref.chapter}.${ref.verse}`;
}

/** Every verse of a reference, in the order the ranges were written. */
export function listVerses(ref: Reference, versification: Versification): VerseRef[] {
	const verses: VerseRef[] = [];
	for (const { start, end } of ref.ranges) {
		const counts = versification[start.book];
		for (let chapter = start.chapter; chapter <= end.chapter; chapter++) {
			const from = chapter === start.chapter ? start.verse : 1;
			const to = chapter === end.chapter ? end.verse : counts[chapter - 1];
			for (let verse = from; verse <= to; verse++)
				verses.push({ book: start.book, chapter, verse });
		}
	}
	return verses;
}

export function countVerses(ref: Reference, versification: Versification): number {
	return listVerses(ref, versification).length;
}
