import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { BookId, BookText, Reference, TranslationId, Verse } from '../model.ts';
import { booksNeeded, passageFromBooks } from './static.ts';

const ref = (
	book: string,
	sc: number,
	sv: number,
	ec: number,
	ev: number,
	label = 'x'
): Reference => ({
	label,
	ranges: [{ start: { book, chapter: sc, verse: sv }, end: { book, chapter: ec, verse: ev } }]
});

const mat: BookText = {
	book: 'MAT',
	translation: 'bsb',
	chapters: [
		[
			{ v: 1, lines: [{ text: 'one', indent: 0 }] },
			{ v: 2, lines: [{ text: 'two', indent: 0 }] }
		],
		[
			{ v: 1, title: 'T', lines: [{ text: 'a', indent: 0, paragraph: true }] },
			{ v: 3, lines: [{ text: 'c', indent: 1 }] }
		]
	]
};

describe('passageFromBooks', () => {
	it('returns the verses of a range in order, with title and lines', () => {
		const p = passageFromBooks(ref('MAT', 2, 1, 2, 1), 'bsb', { MAT: mat });
		expect(p.translation).toBe('bsb');
		expect(p.ref.label).toBe('x');
		expect(p.verses).toEqual([
			{
				ref: { book: 'MAT', chapter: 2, verse: 1 },
				title: 'T',
				lines: [{ text: 'a', indent: 0, paragraph: true }]
			}
		]);
	});

	it('marks a verse absent from the text as omitted', () => {
		const p = passageFromBooks(ref('MAT', 2, 1, 2, 3), 'bsb', { MAT: mat });
		expect(p.verses.map((v) => [v.ref.verse, v.omitted ?? false, v.lines.length])).toEqual([
			[1, false, 1],
			[2, true, 0],
			[3, false, 1]
		]);
	});

	it('runs across chapters to the end of each chapter', () => {
		const p = passageFromBooks(ref('MAT', 1, 2, 2, 1), 'bsb', { MAT: mat });
		expect(p.verses.map((v) => `${v.ref.chapter}:${v.ref.verse}`)).toEqual(['1:2', '2:1']);
	});

	it('joins several ranges, possibly in different books', () => {
		const jud: BookText = {
			book: 'JUD',
			translation: 'bsb',
			chapters: [[{ v: 5, lines: [{ text: 'five', indent: 0 }] }]]
		};
		const r: Reference = {
			label: 'x',
			ranges: [...ref('MAT', 1, 1, 1, 1).ranges, ...ref('JUD', 1, 5, 1, 5).ranges]
		};
		const p = passageFromBooks(r, 'bsb', { MAT: mat, JUD: jud });
		expect(p.verses.map((v) => v.lines[0].text)).toEqual(['one', 'five']);
	});

	it('throws when a needed book is missing', () => {
		expect(() => passageFromBooks(ref('JHN', 3, 16, 3, 16), 'bsb', { MAT: mat })).toThrow(/JHN/);
	});

	it('throws when the book is from another translation', () => {
		expect(() => passageFromBooks(ref('MAT', 1, 1, 1, 1), 'kjv', { MAT: mat })).toThrow(/bsb/);
	});

	it('throws when the range is outside the text', () => {
		expect(() => passageFromBooks(ref('MAT', 3, 1, 3, 1), 'bsb', { MAT: mat })).toThrow(
			/chapter 3/
		);
		expect(() => passageFromBooks(ref('MAT', 1, 1, 1, 9), 'bsb', { MAT: mat })).toThrow(/verse 9/);
	});
});

describe('booksNeeded', () => {
	it('lists each book once, in order of first use', () => {
		const refs = [ref('JHN', 3, 16, 3, 16), ref('PSA', 23, 1, 23, 6), ref('JHN', 1, 1, 1, 1)];
		expect(booksNeeded(refs)).toEqual(['JHN', 'PSA']);
	});
});

// ---------------------------------------------------------------------------------------------
// Golden files: real passages from the committed text, rendered for a human to judge.

function load(translation: TranslationId, book: BookId): BookText {
	const url = new URL(`../../../../static/text/${translation}/${book}.json`, import.meta.url);
	return JSON.parse(readFileSync(url, 'utf8'));
}

/**
 * One output line per text line: "c:v | text" with four spaces per indent level, then markers.
 * Continuation lines of a verse leave the reference blank so verse boundaries stand out.
 */
function render(verses: Verse[]): string {
	const width = Math.max(...verses.map((v) => `${v.ref.chapter}:${v.ref.verse}`.length));
	const out: string[] = [];
	for (const v of verses) {
		const num = `${v.ref.chapter}:${v.ref.verse}`.padStart(width);
		const blank = ' '.repeat(width);
		if (v.title !== undefined) out.push(`${num} | [title] ${v.title}`);
		if (v.omitted) out.push(`${num} | [omitted]`);
		v.lines.forEach((l, i) => {
			const marks = [l.paragraph && '[para]', l.selah && '[selah]'].filter(Boolean).join(' ');
			const text = '    '.repeat(l.indent) + l.text + (marks ? `   ${marks}` : '');
			out.push(`${i === 0 && v.title === undefined ? num : blank} | ${text}`);
		});
	}
	return out.join('\n') + '\n';
}

const GOLDEN: [name: string, book: BookId, sc: number, sv: number, ec: number, ev: number][] = [
	['james-1-2-4', 'JAS', 1, 2, 1, 4],
	['psalm-23', 'PSA', 23, 1, 23, 6],
	['proverbs-3-5-6', 'PRO', 3, 5, 3, 6],
	['john-3-16-17', 'JHN', 3, 16, 3, 17],
	['romans-8-38-39', 'ROM', 8, 38, 8, 39],
	['matthew-17-20-22', 'MAT', 17, 20, 17, 22],
	['psalm-51-1-2', 'PSA', 51, 1, 51, 2],
	['psalm-46-1-3', 'PSA', 46, 1, 46, 3]
];

describe.each(['bsb', 'web', 'kjv'] as const)('golden text: %s', (translation) => {
	it.each(GOLDEN)('%s', async (name, book, sc, sv, ec, ev) => {
		const p = passageFromBooks(ref(book, sc, sv, ec, ev), translation, {
			[book]: load(translation, book)
		});
		await expect(render(p.verses)).toMatchFileSnapshot(
			`../../../../tests/golden/text/${translation}/${name}.txt`
		);
	});
});
