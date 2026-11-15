import { describe, expect, it } from 'vitest';
import { BOOKS, findBook } from './books.ts';

describe('BOOKS', () => {
	it('lists the 66 books in canonical order', () => {
		expect(BOOKS).toHaveLength(66);
		expect(BOOKS[0].id).toBe('GEN');
		expect(BOOKS[18].id).toBe('PSA');
		expect(BOOKS[21].id).toBe('SNG');
		expect(BOOKS[39].id).toBe('MAT');
		expect(BOOKS[64].id).toBe('JUD');
		expect(BOOKS[65].id).toBe('REV');
	});

	it('has unique ids and unique names', () => {
		expect(new Set(BOOKS.map((b) => b.id)).size).toBe(66);
		expect(new Set(BOOKS.map((b) => b.name)).size).toBe(66);
	});

	it('never maps a name or alias to two books', () => {
		const owners = new Map<string, string>();
		for (const book of BOOKS) {
			for (const text of [book.name, ...book.aliases]) {
				const key = text.toLowerCase().replace(/[\s.]/g, '');
				expect(owners.get(key) ?? book.id, `"${text}" is ambiguous`).toBe(book.id);
				owners.set(key, book.id);
			}
		}
	});

	it('resolves every name and alias back to its own book', () => {
		for (const book of BOOKS) {
			for (const text of [book.name, ...book.aliases]) {
				expect(findBook(text)?.id, text).toBe(book.id);
			}
		}
	});
});

describe('findBook', () => {
	it.each([
		['Genesis', 'GEN'],
		['gen', 'GEN'],
		['Gn', 'GEN'],
		['Ge', 'GEN'],
		['Ps', 'PSA'],
		['Psa', 'PSA'],
		['Psalm', 'PSA'],
		['Psalms', 'PSA'],
		['PSALMS', 'PSA'],
		['Jn', 'JHN'],
		['Jhn', 'JHN'],
		['John', 'JHN'],
		['Jon', 'JON'],
		['Jonah', 'JON'],
		['Mt', 'MAT'],
		['Matt', 'MAT'],
		['Phil', 'PHP'],
		['Php', 'PHP'],
		['Phm', 'PHM'],
		['Philem', 'PHM'],
		['Philemon', 'PHM'],
		['Song of Songs', 'SNG'],
		['Song of Solomon', 'SNG'],
		['Canticles', 'SNG'],
		['SoS', 'SNG'],
		['Judg', 'JDG'],
		['Judges', 'JDG'],
		['Jude', 'JUD'],
		['Am', 'AMO'],
		['Ob', 'OBA'],
		['Rev', 'REV'],
		['Revelation', 'REV'],
		['1 John', '1JN'],
		['1John', '1JN'],
		['1 Jn', '1JN'],
		['I John', '1JN'],
		['i john', '1JN'],
		['First John', '1JN'],
		['1st John', '1JN'],
		['2 John', '2JN'],
		['III John', '3JN'],
		['Third John', '3JN'],
		['1 Cor', '1CO'],
		['2 Corinthians', '2CO'],
		['II Timothy', '2TI'],
		['1 Sam', '1SA'],
		['2 Kgs', '2KI'],
		['1 Chron', '1CH'],
		['1 Pet', '1PE'],
		['1 Thess', '1TH'],
		['Gen.', 'GEN'],
		['  1   Jn.  ', '1JN'],
		['Song  of   Songs', 'SNG']
	])('finds %j as %s', (input, id) => {
		expect(findBook(input)?.id).toBe(id);
	});

	it.each([
		['Jud'],
		['Ph'],
		['Ez'],
		['Jo'],
		['Co'],
		[''],
		['   '],
		['Hezekiah'],
		['4 John'],
		['John 3'],
		['Maccabees']
	])('does not find %j', (input) => {
		expect(findBook(input)).toBeUndefined();
	});

	it('names Psalms "Psalm" and the Song "Song of Songs"', () => {
		expect(findBook('ps')?.name).toBe('Psalm');
		expect(findBook('sos')?.name).toBe('Song of Songs');
	});
});
