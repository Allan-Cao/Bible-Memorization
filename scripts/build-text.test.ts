import { describe, expect, it } from 'vitest';
import type { BookText, Line, StoredVerse } from '../src/lib/core/model.ts';
import { BOOK_CODES, parseUsfm, serializeBook, versificationOf } from './build-text.ts';

/** Wraps chapter content in the header every eBible file starts with. */
function usfm(book: string, body: string): string {
	return `\\id ${book} - test\n\\h Test\n\\toc1 Test\n\\mt1 Test\n${body}\n`;
}

function verses(book: string, body: string, chapter = 1): StoredVerse[] {
	return parseUsfm(usfm(book, body), 'bsb').chapters[chapter - 1];
}

function verse(book: string, body: string, v: number, chapter = 1): StoredVerse {
	const found = verses(book, body, chapter).find((x) => x.v === v);
	if (!found) throw new Error(`verse ${v} not parsed`);
	return found;
}

const line = (text: string, indent: Line['indent'] = 0, extra: Partial<Line> = {}): Line => ({
	text,
	indent,
	...extra
});

describe('BOOK_CODES', () => {
	it('lists the 66 Protestant books in canonical order', () => {
		expect(BOOK_CODES).toHaveLength(66);
		expect(BOOK_CODES[0]).toBe('GEN');
		expect(BOOK_CODES[18]).toBe('PSA');
		expect(BOOK_CODES[39]).toBe('MAT');
		expect(BOOK_CODES[65]).toBe('REV');
		expect(new Set(BOOK_CODES).size).toBe(66);
	});
});

describe('parseUsfm: verses and chapters', () => {
	it('reads the book code from \\id and positions verses by \\c and \\v', () => {
		const book = parseUsfm(
			usfm('JAS', '\\c 1\n\\p\n\\v 1 James, a servant.\n\\c 2\n\\p\n\\v 1 My brothers.'),
			'web'
		);
		expect(book.book).toBe('JAS');
		expect(book.translation).toBe('web');
		expect(book.chapters).toHaveLength(2);
		expect(book.chapters[1][0]).toEqual({
			v: 1,
			lines: [line('My brothers.', 0, { paragraph: true })]
		});
	});

	it('never puts verse numbers in the text', () => {
		const vs = verses('JHN', '\\c 1\n\\p\n\\v 16 For God so loved.\n\\v 17 For God did not.');
		expect(vs.map((v) => v.v)).toEqual([16, 17]);
		expect(vs[1].lines[0].text).toBe('For God did not.');
	});

	it('leaves omitted verses absent', () => {
		const vs = verses(
			'MAT',
			'\\c 1\n\\p\n\\v 20 Nothing will be impossible.\n\\p\n\\v 22 When they gathered.'
		);
		expect(vs.map((v) => v.v)).toEqual([20, 22]);
	});

	it('fails on a verse bridge', () => {
		expect(() => verses('GEN', '\\c 1\n\\p\n\\v 1-2 In the beginning.')).toThrow(/bridge/i);
	});

	it('fails on verses out of order or chapters out of sequence', () => {
		expect(() => verses('GEN', '\\c 1\n\\p\n\\v 2 a\n\\v 1 b')).toThrow(/order/);
		expect(() => verses('GEN', '\\c 2\n\\p\n\\v 1 a')).toThrow(/chapter/i);
	});

	it('fails on text outside any verse', () => {
		expect(() => verses('GEN', '\\c 1\n\\p Stray text\n\\v 1 a')).toThrow(/outside/);
	});

	it('leaves out a verse whose only content is a footnote', () => {
		// WEB Luke 17:36
		const vs = verses(
			'LUK',
			'\\c 1\n\\p\n\\v 35 the other left.\n\\v 36 \\f + \\fr 17:36 \\ft Some Greek manuscripts add: “Two will be in the field.”\\f*\n\\p\n\\v 37 They answered.'
		);
		expect(vs.map((v) => v.v)).toEqual([35, 37]);
	});

	it('fails on a verse with no text', () => {
		expect(() => verses('GEN', '\\c 1\n\\p\n\\v 1\n\\v 2 b')).toThrow(/no text/);
	});
});

describe('parseUsfm: prose', () => {
	it('keeps a prose verse on one line even when it spans source lines', () => {
		const v = verse(
			'ROM',
			'\\c 1\n\\p\n\\v 38 For I am convinced\nthat neither death nor life.',
			38
		);
		expect(v.lines).toEqual([
			line('For I am convinced that neither death nor life.', 0, { paragraph: true })
		]);
	});

	it('marks only the verse that starts a paragraph', () => {
		// BSB James 1: \b then \m starts a paragraph; following verses continue it.
		const vs = verses(
			'JAS',
			'\\c 1\n\\p\n\\v 1 James.\n\\b\n\\m\n\\v 2 Consider it pure joy,\n\\v 3 because you know.'
		);
		expect(vs[1].lines).toEqual([line('Consider it pure joy,', 0, { paragraph: true })]);
		expect(vs[2].lines).toEqual([line('because you know.')]);
	});

	it('treats \\m without a blank line as a new line that continues the paragraph', () => {
		// WEB Romans 8:36-37: prose resumes after a poetry quotation.
		const vs = verses(
			'ROM',
			'\\c 1\n\\p\n\\v 36 Even as it is written,\n\\q1 “For your sake we are killed all day long.\n\\q2 We were accounted as sheep for the slaughter.”\n\\m\n\\v 37 No, in all these things.'
		);
		expect(vs[0].lines).toEqual([
			line('Even as it is written,', 0, { paragraph: true }),
			line('“For your sake we are killed all day long.'),
			line('We were accounted as sheep for the slaughter.”', 1)
		]);
		expect(vs[1].lines).toEqual([line('No, in all these things.')]);
	});

	it('starts a new paragraph line when \\p falls inside a verse', () => {
		// WEB Habakkuk 3:19
		const v = verse(
			'HAB',
			'\\c 1\n\\q1\n\\v 19 GOD, the Lord, is my strength.\n\\q2 and enables me to go in high places.\n\\p For the music director, on my stringed instruments.',
			19
		);
		expect(v.lines).toEqual([
			line('GOD, the Lord, is my strength.', 0, { paragraph: true }),
			line('and enables me to go in high places.', 1),
			line('For the music director, on my stringed instruments.', 0, { paragraph: true })
		]);
	});

	it('handles the other paragraph styles used by BSB and WEB', () => {
		const vs = verses(
			'EZR',
			'\\c 1\n\\p\n\\v 1 a\n\\b\n\\pmo\n\\v 2 b\n\\pc HOLY TO THE LORD.\n\\pi1\n\\v 3 c\n\\mi d\n\\li1\n\\v 4 e\n\\li2 f\n\\nb\n\\v 5 g'
		);
		expect(vs.map((v) => v.lines)).toEqual([
			[line('a', 0, { paragraph: true })],
			[line('b', 0, { paragraph: true }), line('HOLY TO THE LORD.', 0, { paragraph: true })],
			[line('c', 1, { paragraph: true }), line('d', 1)],
			[line('e'), line('f', 1)],
			[line('g')]
		]);
	});

	it('does not mark a chapter that opens with \\nb as a new paragraph', () => {
		const book = parseUsfm(usfm('GEN', '\\c 1\n\\p\n\\v 1 a\n\\c 2\n\\nb\n\\v 1 b'), 'web');
		expect(book.chapters[1][0].lines).toEqual([line('b')]);
	});
});

describe('parseUsfm: poetry', () => {
	// BSB Psalm 23:3-5
	const psalm = [
		'\\c 1',
		'\\q1',
		'\\v 3 He restores my soul;',
		'\\q2 He guides me in the paths of righteousness',
		'\\q2 for the sake of His name.',
		'\\q1',
		'\\v 4 Even though I walk,',
		'\\q2 I will fear no evil,',
		'\\b',
		'\\q1',
		'\\v 5 You prepare a table before me',
		'\\q3 deeper',
		'\\q4 deepest'
	].join('\n');

	it('starts a line for each poetry marker with indent = level - 1', () => {
		expect(verse('PSA', psalm, 3).lines).toEqual([
			line('He restores my soul;', 0, { paragraph: true }),
			line('He guides me in the paths of righteousness', 1),
			line('for the sake of His name.', 1)
		]);
	});

	it('gives a stanza after \\b the paragraph flag, and caps indent at 3', () => {
		expect(verse('PSA', psalm, 4).lines[0]).toEqual(line('Even though I walk,'));
		expect(verse('PSA', psalm, 5).lines).toEqual([
			line('You prepare a table before me', 0, { paragraph: true }),
			line('deeper', 2),
			line('deepest', 3)
		]);
	});

	it('lets a verse continue the indent of the line before it when no marker precedes it', () => {
		// WEB Romans 3:15-16: "\q2" then "\v 16" on the same poetic line level
		const vs = verses('ROM', '\\c 1\n\\q1\n\\v 15 a\n\\q2\n\\v 16 b\n\\v 17 c');
		expect(vs[2].lines).toEqual([line('c', 1)]);
	});

	it('mixes prose and poetry in one verse', () => {
		// BSB Romans 3:10
		const v = verse(
			'ROM',
			'\\c 1\n\\p\n\\v 10 As it is written:\n\\b\n\\q1 “There is no one righteous,\n\\q2 not even one.',
			10
		);
		expect(v.lines).toEqual([
			line('As it is written:', 0, { paragraph: true }),
			line('“There is no one righteous,', 0, { paragraph: true }),
			line('not even one.', 1)
		]);
	});

	it('removes acrostic headings', () => {
		// BSB \qa, KJV \s1 \tl, WEB \d with a Hebrew letter name
		const vs = verses(
			'PSA',
			'\\c 1\n\\qa ALEPH\n\\q1\n\\v 1 a\n\\s1 \\tl  ב BETH.\\tl*\n\\q1\n\\v 2 b\n\\d BETH\n\\q1\n\\v 3 c\n\\d \\w HE|strong="H3588"\\w*\n\\q1\n\\v 4 d'
		);
		expect(vs.map((v) => [v.title, v.lines.map((l) => l.text)])).toEqual([
			[undefined, ['a']],
			[undefined, ['b']],
			[undefined, ['c']],
			[undefined, ['d']]
		]);
	});
});

describe('parseUsfm: psalm titles', () => {
	it('puts \\d on the first verse as title, not in the lines (BSB, with headings first)', () => {
		const v = verse(
			'PSA',
			'\\c 1\n\\s1 The LORD Is My Shepherd\n\\r (Ezekiel 34:11–24)\n\\d A Psalm of David.\n\\q1\n\\v 1 The LORD is my shepherd;\\f + \\fr 23:1 \\ft See Revelation 7:17.\\f*\n\\q2 I shall not want.',
			1
		);
		expect(v).toEqual({
			v: 1,
			title: 'A Psalm of David.',
			lines: [
				line('The LORD is my shepherd;', 0, { paragraph: true }),
				line('I shall not want.', 1)
			]
		});
	});

	it('removes footnotes inside a title', () => {
		// BSB Psalm 46
		const v = verse(
			'PSA',
			'\\c 1\n\\d For the choirmaster. According to Alamoth.\\f + \\fr 46:0 \\ft Alamoth is a term.\\f* A song.\n\\b\n\\q1\n\\v 1 God is our refuge.',
			1
		);
		expect(v.title).toBe('For the choirmaster. According to Alamoth. A song.');
	});

	it('ignores an empty \\d', () => {
		// BSB Zechariah 12
		expect(verse('ZEC', '\\c 1\n\\d\n\\v 1 This is the burden.', 1).title).toBeUndefined();
	});

	it('fails on a title after the first verse', () => {
		expect(() =>
			verses('PSA', '\\c 1\n\\q1\n\\v 1 a\n\\d A Psalm of David.\n\\q1\n\\v 2 b')
		).toThrow(/title/);
	});
});

describe('parseUsfm: Selah', () => {
	const selah = line('Selah', 0, { selah: true });

	it('BSB: \\qr Selah is its own selah line', () => {
		const v = verse(
			'PSA',
			'\\c 1\n\\q1\n\\v 3 though their waters roar\n\\q2 and the mountains quake.\n\\qr Selah\n\\q1\n\\v 4 There is a river',
			3
		);
		expect(v.lines).toEqual([
			line('though their waters roar', 0, { paragraph: true }),
			line('and the mountains quake.', 1),
			selah
		]);
	});

	it('BSB: keeps other \\qr lines as indented text', () => {
		const v = verse(
			'JER',
			'\\c 1\n\\q1\n\\v 1 and he will not enter this city,’\n\\qr declares the LORD.',
			1
		);
		expect(v.lines[1]).toEqual(line('declares the LORD.', 1));
	});

	it('BSB: \\qr Higgaion Selah keeps both words', () => {
		expect(verse('PSA', '\\c 1\n\\q1\n\\v 16 a\n\\qr Higgaion Selah', 16).lines[1]).toEqual(
			line('Higgaion Selah', 0, { selah: true })
		);
	});

	it('WEB: inline \\qs Selah.\\qs* is split off and its punctuation dropped', () => {
		const v = verse(
			'PSA',
			'\\c 1\n\\q2\n\\v 3 though the mountains tremble with their swelling. \\qs Selah.\\qs*\n\\b',
			3
		);
		expect(v.lines).toEqual([
			line('though the mountains tremble with their swelling.', 1, { paragraph: true }),
			selah
		]);
	});

	it('KJV: a bare Selah ending a line is split off', () => {
		const v = verse(
			'PSA',
			'\\c 1\n\\q1\n\\v 3 the mountains shake with the swelling thereof. Selah.',
			3
		);
		expect(v.lines).toEqual([
			line('the mountains shake with the swelling thereof.', 0, { paragraph: true }),
			selah
		]);
	});

	it('KJV: a bare Selah followed by a footnote and "Selah:" are split off', () => {
		const a = verse(
			'PSA',
			'\\c 1\n\\q1\n\\v 7 our refuge. Selah.\\f + \\fr 46.7 \\ft our…: Heb. high\\f*',
			7
		);
		expect(a.lines).toEqual([line('our refuge.', 0, { paragraph: true }), selah]);
		const b = verse('PSA', '\\c 1\n\\q1\n\\v 7 through the wilderness; Selah:', 7);
		expect(b.lines).toEqual([line('through the wilderness;', 0, { paragraph: true }), selah]);
	});

	it('KJV: a bare "Selah." inside a verse splits the line in three', () => {
		// KJV Habakkuk 3:3
		const v = verse(
			'HAB',
			'\\c 1\n\\p\n\\v 3 from mount Paran. Selah. His glory covered the heavens.',
			3
		);
		expect(v.lines).toEqual([
			line('from mount Paran.', 0, { paragraph: true }),
			selah,
			line('His glory covered the heavens.')
		]);
	});

	it('leaves the place name Selah alone', () => {
		// KJV 2 Kings 14:7
		const v = verse(
			'2KI',
			'\\c 1\n\\p\n\\v 7 and took Selah by war, and called the name of it Joktheel.',
			7
		);
		expect(v.lines).toEqual([
			line('and took Selah by war, and called the name of it Joktheel.', 0, { paragraph: true })
		]);
	});
});

describe('parseUsfm: removed content', () => {
	it('removes footnotes and cross references without leaving spaces before punctuation', () => {
		const v = verse(
			'ROM',
			'\\c 1\n\\p\n\\v 17 As it is written, “But the righteous shall live by faith.”\\x + \\xo 1:17 \\xt Habakkuk 2:4\\x* And he only \\f + \\fr 3:16 \\ft Or unique\\f* Son \\f + \\fr 1 \\ft note\\f*, yes \\f + \\fr 1 \\ft Hebrew \\fq He\\f*.',
			17
		);
		expect(v.lines[0].text).toBe(
			'As it is written, “But the righteous shall live by faith.” And he only Son, yes.'
		);
		// BSB Amos 1:15
		const dash = verse(
			'AMO',
			'\\c 1\n\\q1\n\\v 15 will go into exile \\f + \\fr 1:15 \\ft Possibly Milcom\\f*—',
			15
		);
		expect(dash.lines[0].text).toBe('will go into exile—');
	});

	it('removes section headings, chapter labels, speakers and colophons', () => {
		const vs = verses(
			'SNG',
			'\\cl Psalm\n\\c 1\n\\ms1 BOOK I\n\\mr Psalms 1—41\n\\s1 The Two Paths\n\\r (Matthew 5:3–12)\n\\s2 The First Day\n\\sp Beloved\n\\p\n\\v 1 a\n\\s1 Written to the Romans from Corinthus.'
		);
		expect(vs).toEqual([{ v: 1, lines: [line('a', 0, { paragraph: true })] }]);
	});

	it("keeps only the word from Strong's-tagged words, including nested \\+w", () => {
		const v = verse(
			'PSA',
			'\\c 1\n\\q1\n\\v 1 Blessed \\w is|strong="H1870"\\w* \\w the man’s hand|strong="H7563"\\w*, \\wj \\+w Verily|strong="G281"\\+w*\\wj*',
			1
		);
		expect(v.lines[0].text).toBe('Blessed is the man’s hand, Verily');
	});
});

describe('parseUsfm: character markup', () => {
	it('unwraps \\wj, \\add, \\bk, \\it, \\tl and nested + forms', () => {
		const v = verse(
			'JHN',
			'\\c 1\n\\p\n\\v 5 Jesus answered, \\wj  Verily, born of water and \\+add of\\+add* the Spirit.\\wj* \\add is\\add* in \\bk The Book of the Wars\\bk*, \\it For the choirmaster.\\it* \\tl Eli\\tl*',
			5
		);
		expect(v.lines[0].text).toBe(
			'Jesus answered, Verily, born of water and of the Spirit. is in The Book of the Wars, For the choirmaster. Eli'
		);
	});

	it('writes \\nd in capitals and keeps a lowercase possessive', () => {
		const v = verse(
			'PSA',
			'\\c 1\n\\q1\n\\v 1 The \\nd Lord\\nd* and the \\+nd LORD’s\\+nd* house \\nd Jah\\nd*',
			1
		);
		expect(v.lines[0].text).toBe('The LORD and the LORD’s house JAH');
	});

	it('turns the KJV pilcrow into a paragraph flag', () => {
		const vs = verses(
			'JHN',
			'\\c 1\n\\p\n\\v 13 a\n\\p\n\\v 14 \\wj ¶ And as Moses\\wj*\n\\v 15 \\wj  That whosoever\\wj*'
		);
		expect(vs[1].lines).toEqual([line('And as Moses', 0, { paragraph: true })]);
		expect(vs[2].lines).toEqual([line('That whosoever')]);
	});

	it('marks a pilcrow verse as a paragraph even without \\p', () => {
		expect(verse('JHN', '\\c 1\n\\p\n\\v 1 a\n\\v 2 ¶ b', 2).lines).toEqual([
			line('b', 0, { paragraph: true })
		]);
	});

	it('keeps typographic quotes and dashes, joining quote marks split by a non-breaking space (WEB John 5:11)', () => {
		const v = verse(
			'JHN',
			'\\c 1\n\\p\n\\v 11 “He said, \\wj ‘Take up your mat and walk.’\\wj*\u00a0”  —yes',
			11
		);
		expect(v.lines[0].text).toBe('“He said, ‘Take up your mat and walk.’” —yes');
	});

	it('fails on an unknown marker, naming it', () => {
		expect(() => verses('GEN', '\\c 1\n\\p\n\\v 1 In the \\zzz beginning\\zzz*')).toThrow(/\\zzz/);
		expect(() => verses('GEN', '\\c 1\n\\tr\n\\v 1 a')).toThrow(/\\tr/);
	});

	it('fails on an unclosed character marker at a verse boundary', () => {
		expect(() => verses('GEN', '\\c 1\n\\p\n\\v 1 \\wj a\n\\v 2 b\\wj*')).toThrow(/unclosed/i);
	});

	it('fails on a closing marker that was not opened', () => {
		expect(() => verses('GEN', '\\c 1\n\\p\n\\v 1 a\\add*')).toThrow(/\\add\*/);
	});
});

describe('serializeBook', () => {
	it('writes compact JSON with a fixed key order', () => {
		const book: BookText = {
			chapters: [[{ title: 'T', lines: [{ selah: true, indent: 0, text: 'Selah' }], v: 1 }]],
			translation: 'bsb',
			book: 'PSA'
		};
		expect(serializeBook(book)).toBe(
			'{"book":"PSA","translation":"bsb","chapters":[[{"v":1,"title":"T","lines":[{"text":"Selah","indent":0,"selah":true}]}]]}\n'
		);
	});
});

describe('versificationOf', () => {
	it('records the highest verse number of each chapter', () => {
		const book = parseUsfm(usfm('MAT', '\\c 1\n\\p\n\\v 1 a\n\\v 3 c\n\\c 2\n\\p\n\\v 1 a'), 'bsb');
		expect(versificationOf([book])).toEqual({ MAT: [3, 1] });
	});
});
