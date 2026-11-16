/**
 * Passages from the committed Bible text (static/text/{translation}/{BOOK}.json).
 * Pure: the caller fetches the BookText files (see booksNeeded) and passes them in.
 */
import type { BookId, BookText, Passage, Reference, TranslationId, Verse } from '../model.ts';

/** The books a set of references needs, each once, in order of first use. */
export function booksNeeded(refs: Reference[]): BookId[] {
	const ids = new Set<BookId>();
	for (const r of refs) for (const range of r.ranges) ids.add(range.start.book);
	return [...ids];
}

/**
 * Every verse covered by the reference's ranges, in order. A verse number inside the chapter
 * that the stored text lacks (BSB Matthew 17:21) is returned with `omitted: true` and no lines.
 * A chapter runs to its highest stored verse, which is what versification.json records.
 */
export function passageFromBooks(
	ref: Reference,
	translation: TranslationId,
	books: Record<BookId, BookText>
): Passage {
	const verses: Verse[] = [];
	for (const { start, end } of ref.ranges) {
		const book = books[start.book];
		if (!book) throw new Error(`${ref.label}: book ${start.book} is not loaded`);
		if (book.translation !== translation) {
			throw new Error(
				`${ref.label}: ${start.book} is ${book.translation} text, not ${translation}`
			);
		}
		for (let c = start.chapter; c <= end.chapter; c++) {
			const stored = book.chapters[c - 1];
			if (!stored?.length) throw new Error(`${ref.label}: ${start.book} has no chapter ${c}`);
			const last = stored[stored.length - 1].v;
			const from = c === start.chapter ? start.verse : 1;
			const to = c === end.chapter ? end.verse : last;
			if (to > last) {
				throw new Error(`${ref.label}: ${start.book} ${c} has no verse ${to} (last is ${last})`);
			}
			const byNumber = new Map(stored.map((v) => [v.v, v]));
			for (let n = from; n <= to; n++) {
				const r = { book: start.book, chapter: c, verse: n };
				const v = byNumber.get(n);
				if (!v) verses.push({ ref: r, lines: [], omitted: true });
				else if (v.title !== undefined) verses.push({ ref: r, title: v.title, lines: v.lines });
				else verses.push({ ref: r, lines: v.lines });
			}
		}
	}
	return { ref, translation, verses };
}
