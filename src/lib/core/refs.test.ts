import { describe, expect, it } from 'vitest';
import type { Versification } from './model.ts';
import { parseReference, verseKey } from './refs.ts';

// A small table: real counts for the chapters the tests touch, plausible filler elsewhere.
const psalms = Array<number>(150).fill(10);
psalms[0] = 6; // Psalm 1
psalms[1] = 12; // Psalm 2
psalms[22] = 6; // Psalm 23
psalms[116] = 2; // Psalm 117
const vers: Versification = {
	JHN: [51, 25, 36, 54, 47, 71, 53, 59, 41, 42, 57, 50, 38, 31, 27, 33, 26, 40, 42, 31, 25],
	'1JN': [10, 29, 24, 21, 21],
	PSA: psalms,
	JUD: [25],
	OBA: [21]
};

const ranges = (input: string) =>
	parseReference(input, vers).ranges.map((r) => [
		r.start.chapter,
		r.start.verse,
		r.end.chapter,
		r.end.verse
	]);

describe('parseReference: accepted input', () => {
	// [input, normalized label, ranges as [startChapter, startVerse, endChapter, endVerse]]
	it.each([
		['Psalm 23', 'Psalm 23', [[23, 1, 23, 6]]],
		['ps 23', 'Psalm 23', [[23, 1, 23, 6]]],
		['Psalms 23', 'Psalm 23', [[23, 1, 23, 6]]],
		['PSALM 23', 'Psalm 23', [[23, 1, 23, 6]]],
		['  Psalm   23  ', 'Psalm 23', [[23, 1, 23, 6]]],
		['John 3:16', 'John 3:16', [[3, 16, 3, 16]]],
		['John 3:16-18', 'John 3:16-18', [[3, 16, 3, 18]]],
		['John 3 : 16 - 18', 'John 3:16-18', [[3, 16, 3, 18]]],
		['John 3:16–18', 'John 3:16-18', [[3, 16, 3, 18]]],
		['John 3:16—18', 'John 3:16-18', [[3, 16, 3, 18]]],
		['John 3.16', 'John 3:16', [[3, 16, 3, 16]]],
		['jn 3.16-18', 'John 3:16-18', [[3, 16, 3, 18]]],
		['John 3:16-16', 'John 3:16', [[3, 16, 3, 16]]],
		['John 3:16-4:2', 'John 3:16-4:2', [[3, 16, 4, 2]]],
		['John 3:36-4:1', 'John 3:36-4:1', [[3, 36, 4, 1]]],
		['Psalm 1-2', 'Psalm 1-2', [[1, 1, 2, 12]]],
		['Psalm 117', 'Psalm 117', [[117, 1, 117, 2]]],
		['John 3:1-36', 'John 3', [[3, 1, 3, 36]]],
		[
			'John 14:1-3, 6',
			'John 14:1-3, 6',
			[
				[14, 1, 14, 3],
				[14, 6, 14, 6]
			]
		],
		[
			'John 14:1-3,6,13-17',
			'John 14:1-3, 6, 13-17',
			[
				[14, 1, 14, 3],
				[14, 6, 14, 6],
				[14, 13, 14, 17]
			]
		],
		[
			'John 14:6, 15:1',
			'John 14:6, 15:1',
			[
				[14, 6, 14, 6],
				[15, 1, 15, 1]
			]
		],
		[
			'John 14:6, 15:1-3, 5',
			'John 14:6, 15:1-3, 5',
			[
				[14, 6, 14, 6],
				[15, 1, 15, 3],
				[15, 5, 15, 5]
			]
		],
		[
			'John 14:6, 1-3',
			'John 14:6, 1-3',
			[
				[14, 6, 14, 6],
				[14, 1, 14, 3]
			]
		],
		[
			'John 14:6, 15:1-16:2',
			'John 14:6, 15:1-16:2',
			[
				[14, 6, 14, 6],
				[15, 1, 16, 2]
			]
		],
		[
			'John 3:16, 4:1-54',
			'John 3:16, 4:1-54',
			[
				[3, 16, 3, 16],
				[4, 1, 4, 54]
			]
		],
		['1 John 1:9', '1 John 1:9', [[1, 9, 1, 9]]],
		['I John 1:9', '1 John 1:9', [[1, 9, 1, 9]]],
		['1jn 1.9', '1 John 1:9', [[1, 9, 1, 9]]],
		['First John 5', '1 John 5', [[5, 1, 5, 21]]]
	])('%j -> %s', (input, label, expected) => {
		const ref = parseReference(input, vers);
		expect(ref.label).toBe(label);
		expect(ranges(input)).toEqual(expected);
	});

	it('gives the same result however a passage is written', () => {
		const a = parseReference('ps 23', vers);
		expect(parseReference('Psalms 23', vers)).toEqual(a);
		expect(parseReference('Psalm 23', vers)).toEqual(a);
	});

	it('fills in the book id on every verse', () => {
		const [r] = parseReference('John 3:16-4:2', vers).ranges;
		expect(r.start).toEqual({ book: 'JHN', chapter: 3, verse: 16 });
		expect(r.end).toEqual({ book: 'JHN', chapter: 4, verse: 2 });
	});
});

describe('parseReference: single-chapter books', () => {
	// Label rule: no chapter number, so "Jude 5". A lone verse 1 is "Jude 1:1" because "Jude 1" is the whole book.
	it.each([
		['Jude 5', 'Jude 5', [[1, 5, 1, 5]]],
		['Jude 5-7', 'Jude 5-7', [[1, 5, 1, 7]]],
		['Jude 1:5', 'Jude 5', [[1, 5, 1, 5]]],
		['Jude 1:5-7', 'Jude 5-7', [[1, 5, 1, 7]]],
		['Jude 1', 'Jude 1', [[1, 1, 1, 25]]],
		['Jude 1-25', 'Jude 1', [[1, 1, 1, 25]]],
		['Jude 1:1', 'Jude 1:1', [[1, 1, 1, 1]]],
		['Jude 1:1-3', 'Jude 1-3', [[1, 1, 1, 3]]],
		[
			'jude 3, 5-7',
			'Jude 3, 5-7',
			[
				[1, 3, 1, 3],
				[1, 5, 1, 7]
			]
		],
		['Obadiah 15', 'Obadiah 15', [[1, 15, 1, 15]]]
	])('%j -> %s', (input, label, expected) => {
		expect(parseReference(input, vers).label).toBe(label);
		expect(ranges(input)).toEqual(expected);
	});

	it('produces labels that parse back to the same reference', () => {
		for (const input of ['Jude 1', 'Jude 1:1', 'Jude 3, 5-7', 'Jude 5']) {
			const ref = parseReference(input, vers);
			expect(parseReference(ref.label, vers)).toEqual(ref);
		}
	});
});

describe('parseReference: rejected input', () => {
	it.each([
		['', 'Empty'],
		['   ', 'Empty'],
		['Hezekiah 3:1', 'Unknown book "Hezekiah"'],
		['3:16', 'Unknown book'],
		['Jud 5', 'Unknown book "Jud"'],
		['John', 'chapter'],
		['John 30:1', 'John has 21 chapters'],
		['Jude 2:1', 'Jude has 1 chapter'],
		['Psalm 151', 'Psalm has 150 chapters'],
		['John 3:37', 'John 3 has 36 verses'],
		['Jude 26', 'Jude has 25 verses'],
		['Psalm 117:3', 'Psalm 117 has 2 verses'],
		['John 0', 'Chapter 0'],
		['John 0:1', 'Chapter 0'],
		['John 3:0', 'Verse 0'],
		['John 3:0-5', 'Verse 0'],
		['John 3:18-16', 'reversed'],
		['John 4:1-3:16', 'reversed'],
		['Psalm 2-1', 'reversed'],
		['Jude 7-5', 'reversed'],
		['John 3:16a', 'Unexpected'],
		['John 3:16 and 17', 'Unexpected'],
		['John 3 16', 'Unexpected'],
		['John 3:16-', 'Unexpected'],
		['John 3:16,', 'Unexpected'],
		['John 3:16,,18', 'Unexpected'],
		['John 3:16-4', 'reversed'],
		['John 3-4:2', 'Unexpected'],
		['John 3:16-4:2-5', 'Unexpected'],
		['John 3:16-1 John 1:2', 'Unexpected'],
		['John 3:16; Romans 1:1', 'Unexpected'],
		['John 3:16, Romans 1:1', 'Unexpected'],
		['John 3:16, 16-17', 'overlap'],
		['John 3:16, 16', 'overlap'],
		['John 3:16-18, 17', 'overlap'],
		['John 3:16, 17', 'overlap'],
		['John 3:36, 4:1', 'overlap'],
		['John 3:1-3, 2:5, 3:2', 'overlap'],
		['Psalm 23, 3', 'overlap'],
		['Psalm 23, 7', 'Psalm 23 has 6 verses']
	])('%j fails with a message containing %j', (input, fragment) => {
		expect(() => parseReference(input, vers)).toThrow(fragment);
	});

	it('throws plain Errors', () => {
		expect(() => parseReference('John 30:1', vers)).toThrow(Error);
	});

	it('reports a book missing from the versification', () => {
		expect(() => parseReference('Genesis 1:1', vers)).toThrow('Genesis');
	});
});

describe('verseKey', () => {
	it('formats BOOK.chapter.verse', () => {
		expect(verseKey({ book: 'JHN', chapter: 3, verse: 16 })).toBe('JHN.3.16');
		expect(verseKey({ book: '1JN', chapter: 1, verse: 9 })).toBe('1JN.1.9');
	});
});
