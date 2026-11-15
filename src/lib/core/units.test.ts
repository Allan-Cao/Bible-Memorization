import { describe, expect, it } from 'vitest';
import type { Break, Line, Verse } from './model.ts';
import { SOFT_MAX_PART_WORDS, autoBreaks, breakAfter, splitUnits, verseWords } from './units.ts';

const verse = (ref: string, ...lines: (string | Line)[]): Verse => {
	const [book, chapter, v] = ref.split('.');
	return {
		ref: { book, chapter: Number(chapter), verse: Number(v) },
		lines: lines.map((l) => (typeof l === 'string' ? { text: l, indent: 0 } : l))
	};
};
const poem = (ref: string, ...texts: string[]): Verse =>
	verse(ref, ...texts.map((text, i): Line => ({ text, indent: i === 0 ? 0 : 1 })));
const selah: Line = { text: 'Selah', indent: 0, selah: true };

/** "n words" with no punctuation: w0 w1 w2 ... */
const words = (n: number, from = 0) =>
	Array.from({ length: n }, (_, i) => `w${i + from}`).join(' ');

/** Each unit's words, joined, so a split reads as ['first part', 'second part']. */
const parts = (v: Verse, saved?: Break[]) =>
	splitUnits(v, saved).units.map((u) =>
		u.lines
			.filter((l) => !l.selah)
			.map((l) => l.text)
			.join(' ')
	);

// Real BSB wording.
const john3_16 = verse(
	'JHN.3.16',
	'For God so loved the world that He gave His one and only Son, that everyone who believes in Him shall not perish but have eternal life.'
);
const romans8_38 = verse(
	'ROM.8.38',
	'For I am convinced that neither death nor life, neither angels nor principalities, neither the present nor the future, nor any powers,'
);
const romans8_39 = verse(
	'ROM.8.39',
	'neither height nor depth, nor anything else in all creation, will be able to separate us from the love of God that is in Christ Jesus our Lord.'
);
const hebrews1_3 = verse(
	'HEB.1.3',
	'The Son is the radiance of God’s glory and the exact representation of His nature, upholding all things by His powerful word. After He had provided purification for sins, He sat down at the right hand of the Majesty on high.'
);
const ephesians1_3 = verse(
	'EPH.1.3',
	'Blessed be the God and Father of our Lord Jesus Christ, who has blessed us in Christ with every spiritual blessing in the heavenly realms.'
);
// Ephesians 1 style: BSB Ephesians 1:4b-8 (one long Greek sentence) joined into a single 67-word
// verse, so the splitter has to choose three parts among several commas and one period.
const ephesiansStyle = verse(
	'EPH.1.99',
	'In love He predestined us for adoption as His sons through Jesus Christ, according to the good pleasure of His will, to the praise of His glorious grace, which He has freely given us in the Beloved One. In Him we have redemption through His blood, the forgiveness of our trespasses, according to the riches of His grace that He lavished on us with all wisdom and understanding.'
);
const psalm23_4 = poem(
	'PSA.23.4',
	'Even though I walk through the valley of the shadow of death,',
	'I will fear no evil,',
	'for You are with me;',
	'Your rod and Your staff, they comfort me.'
);
const revelation20_4 = verse(
	'REV.20.4',
	'Then I saw the thrones, and those seated on them had been given authority to judge. And I saw the souls of those who had been beheaded for their testimony of Jesus and for the word of God, and those who had not worshiped the beast or its image, and had not received its mark on their foreheads or hands. And they came to life and reigned with Christ for a thousand years.'
);
const isaiah40_31 = poem(
	'ISA.40.31',
	'But those who wait upon the LORD will renew their strength;',
	'they will mount up with wings like eagles;',
	'they will run and not grow weary,',
	'they will walk and not faint.'
);
const psalm46_7 = verse(
	'PSA.46.7',
	{ text: 'The LORD of Hosts is with us;', indent: 0 },
	{ text: 'the God of Jacob is our fortress.', indent: 1 },
	selah
);

describe('verseWords', () => {
	it('splits every line on whitespace, in order, skipping Selah lines', () => {
		expect(verseWords(psalm46_7)).toEqual([
			'The',
			'LORD',
			'of',
			'Hosts',
			'is',
			'with',
			'us;',
			'the',
			'God',
			'of',
			'Jacob',
			'is',
			'our',
			'fortress.'
		]);
	});

	it('breakAfter records the word so a stale break can be detected', () => {
		expect(breakAfter(john3_16, 13)).toEqual({ after: 13, word: 'Son,' });
	});
});

describe('autoBreaks', () => {
	it('does not split a short verse', () => {
		expect(autoBreaks(john3_16)).toEqual([]);
		expect(parts(john3_16)).toHaveLength(1);
	});

	it('does not split a verse of exactly 30 words', () => {
		expect(verseWords(psalm23_4)).toHaveLength(30);
		expect(autoBreaks(psalm23_4)).toEqual([]);
	});

	it('splits a 31-word verse at a usable comma', () => {
		const v = verse('GEN.1.1', `${words(15)}, ${words(16, 15)}`);
		expect(verseWords(v)).toHaveLength(31);
		expect(autoBreaks(v)).toEqual([{ after: 14, word: 'w14,' }]);
		expect(parts(v)).toHaveLength(2);
	});

	it('leaves Romans 8:38-39 whole: each verse is under 30 words in the BSB', () => {
		expect(autoBreaks(romans8_38)).toEqual([]);
		expect(autoBreaks(romans8_39)).toEqual([]);
	});

	it('splits Hebrews 1:3 at its period rather than a more even comma', () => {
		expect(parts(hebrews1_3)).toEqual([
			'The Son is the radiance of God’s glory and the exact representation of His nature, upholding all things by His powerful word.',
			'After He had provided purification for sins, He sat down at the right hand of the Majesty on high.'
		]);
	});

	it('splits a long Ephesians-style sentence into three parts of at least 10 words', () => {
		const result = parts(ephesiansStyle);
		expect(result).toEqual([
			'In love He predestined us for adoption as His sons through Jesus Christ, according to the good pleasure of His will,',
			'to the praise of His glorious grace, which He has freely given us in the Beloved One.',
			'In Him we have redemption through His blood, the forgiveness of our trespasses, according to the riches of His grace that He lavished on us with all wisdom and understanding.'
		]);
	});

	it('never leaves a part under 10 words', () => {
		// The only period would leave 5 words; the comma gives 12 / 20.
		const v = verse('GEN.1.1', `${words(12)}, ${words(15, 12)}. ${words(5, 27)}`);
		expect(parts(v).map((p) => p.split(' ').length)).toEqual([12, 20]);
	});

	it('uses fewer parts when the target number has no valid split', () => {
		// 61 words wants 3 parts, but there is only one punctuation mark.
		const v = verse('GEN.1.1', `${words(30)}; ${words(31, 30)}`);
		expect(parts(v).map((p) => p.split(' ').length)).toEqual([30, 31]);
	});

	it('prefers the split closest to even among equal strengths', () => {
		const v = verse('GEN.1.1', `${words(11)}, ${words(9, 11)}, ${words(20, 20)}`);
		// Commas after 11 and 20 words: 20 / 20 beats 11 / 29.
		expect(autoBreaks(v)).toEqual([{ after: 19, word: 'w19,' }]);
	});

	it('prefers a weaker break that keeps every part within the soft cap', () => {
		// The period gives 10 / 40; the comma gives 25 / 25.
		const v = verse('GEN.1.1', `${words(10)}. ${words(15, 10)}, ${words(25, 25)}`);
		expect(SOFT_MAX_PART_WORDS).toBe(35);
		expect(parts(v).map((p) => p.split(' ').length)).toEqual([25, 25]);
	});

	it('still prefers strength over evenness among splits within the soft cap', () => {
		// The period gives 28 / 32; the comma gives 30 / 30.
		const v = verse('GEN.1.1', `${words(28)}. ${words(2, 28)}, ${words(30, 30)}`);
		expect(parts(v).map((p) => p.split(' ').length)).toEqual([28, 32]);
	});

	it('falls back to the strongest split when none keeps within the soft cap', () => {
		// The period gives 10 / 40, the comma 12 / 38: both over 35, so the period wins.
		const v = verse('GEN.1.1', `${words(10)}. ${words(2, 10)}, ${words(38, 12)}`);
		expect(parts(v).map((p) => p.split(' ').length)).toEqual([10, 40]);
	});

	it('uses one more part when only that keeps every part within the soft cap', () => {
		// 52 words want 2 parts, but 12 / 40 and 40 / 12 are over 35; 12 / 28 / 12 is not.
		const v = verse('GEN.1.1', `${words(12)}, ${words(28, 12)}, ${words(12, 40)}`);
		expect(parts(v).map((p) => p.split(' ').length)).toEqual([12, 28, 12]);
	});

	it('keeps every part of Revelation 20:4 within the soft cap', () => {
		const sizes = parts(revelation20_4).map((p) => p.split(' ').length);
		expect(sizes).toHaveLength(3);
		expect(Math.max(...sizes)).toBeLessThanOrEqual(SOFT_MAX_PART_WORDS);
	});

	it('does not split a long verse with no punctuation', () => {
		expect(autoBreaks(verse('GEN.1.1', words(45)))).toEqual([]);
	});

	it('does not split when no punctuation leaves 10 words on each side', () => {
		expect(autoBreaks(verse('GEN.1.1', `${words(5)}, ${words(35, 5)}`))).toEqual([]);
	});

	it('ignores closing quotes and brackets after punctuation', () => {
		const v = verse('GEN.1.1', `${words(10)}, ${words(5, 10)} faith.” ${words(15, 15)}`);
		expect(autoBreaks(v)).toEqual([{ after: 15, word: 'faith.”' }]);
	});

	it.each([
		['?', 'w15?'],
		['!', 'w15!'],
		[';', 'w15;'],
		[':', 'w15:'],
		['—', 'w15—']
	])('treats %s as a break point', (mark, word) => {
		const v = verse('GEN.1.1', `${words(16)}${mark} ${words(16, 16)}`);
		expect(autoBreaks(v)).toEqual([{ after: 15, word }]);
	});

	it('breaks a long poetry verse on a line boundary', () => {
		expect(parts(isaiah40_31)).toEqual([
			'But those who wait upon the LORD will renew their strength; they will mount up with wings like eagles;',
			'they will run and not grow weary, they will walk and not faint.'
		]);
	});

	it('prefers a line end without punctuation over a mid-line period', () => {
		const v = poem('PSA.1.1', `${words(12)}. ${words(8, 12)}`, words(12, 20));
		expect(autoBreaks(v)).toEqual([{ after: 19, word: 'w19' }]);
	});
});

describe('splitUnits', () => {
	it('gives one unit holding the whole verse when there are no breaks', () => {
		const { units, stale } = splitUnits(john3_16);
		expect(stale).toBe(false);
		expect(units).toEqual([{ verse: john3_16.ref, index: 0, count: 1, lines: john3_16.lines }]);
	});

	it('numbers units and records their count', () => {
		const { units } = splitUnits(hebrews1_3);
		expect(units.map((u) => [u.index, u.count])).toEqual([
			[0, 2],
			[1, 2]
		]);
		expect(units.every((u) => u.verse === hebrews1_3.ref)).toBe(true);
	});

	it('keeps Selah with the unit before it and does not count it', () => {
		const v = verse(
			'PSA.3.2',
			{ text: words(16), indent: 0 },
			{ text: `${words(15, 16)}.`, indent: 1 },
			selah
		);
		expect(verseWords(v)).toHaveLength(31);
		const { units } = splitUnits(v);
		expect(units).toHaveLength(2);
		expect(units[1].lines.at(-1)).toEqual(selah);
	});

	it('keeps Selah with the preceding unit when the break is at the Selah', () => {
		const v = verse('PSA.3.2', { text: words(16), indent: 0 }, selah, {
			text: words(15, 16),
			indent: 0,
			paragraph: true
		});
		const { units } = splitUnits(v);
		expect(units.map((u) => u.lines.map((l) => l.text))).toEqual([
			[words(16), 'Selah'],
			[words(15, 16)]
		]);
	});

	it('gives no units for an omitted verse', () => {
		const omitted: Verse = {
			ref: { book: 'MAT', chapter: 17, verse: 21 },
			lines: [],
			omitted: true
		};
		expect(splitUnits(omitted)).toEqual({ units: [], stale: false });
	});

	it('respects saved breaks', () => {
		const saved = [breakAfter(john3_16, 13)];
		expect(splitUnits(john3_16, saved).stale).toBe(false);
		expect(parts(john3_16, saved)).toEqual([
			'For God so loved the world that He gave His one and only Son,',
			'that everyone who believes in Him shall not perish but have eternal life.'
		]);
	});

	it('gives one unit for an empty saved array, even for a long verse', () => {
		expect(parts(hebrews1_3, [])).toHaveLength(1);
		expect(splitUnits(hebrews1_3, []).stale).toBe(false);
	});

	it.each([
		['word changed', [{ after: 13, word: 'Son' }]],
		['position past the end', [{ after: 99, word: 'Son,' }]],
		['after the last word', [{ after: 26, word: 'life.' }]],
		['negative position', [{ after: -1, word: 'For' }]],
		['one good, one bad', [breakAfter(john3_16, 13), { after: 3, word: 'nope' }]]
	])('falls back to automatic breaks when a saved break is stale (%s)', (_, saved) => {
		const result = splitUnits(john3_16, saved);
		expect(result.stale).toBe(true);
		expect(result.units).toEqual(splitUnits(john3_16).units);
	});

	it('falls back to the automatic split of a long verse when stale', () => {
		const result = splitUnits(hebrews1_3, [{ after: 3, word: 'nope' }]);
		expect(result.stale).toBe(true);
		expect(parts(hebrews1_3, [{ after: 3, word: 'nope' }])).toEqual(parts(hebrews1_3));
	});

	it('splits a line at a break inside it; the pieces rejoin to the original', () => {
		const v = verse('PRO.3.5', {
			text: 'Trust in the LORD with all your heart,',
			indent: 2,
			paragraph: true
		});
		const { units } = splitUnits(v, [breakAfter(v, 3)]);
		expect(units.map((u) => u.lines)).toEqual([
			[{ text: 'Trust in the LORD', indent: 2, paragraph: true }],
			[{ text: 'with all your heart,', indent: 2 }]
		]);
		expect(`${units[0].lines[0].text} ${units[1].lines[0].text}`).toBe(v.lines[0].text);
	});

	it('splits between lines without changing either line', () => {
		const { units } = splitUnits(isaiah40_31, [breakAfter(isaiah40_31, 10)]);
		expect(units.map((u) => u.lines)).toEqual([
			isaiah40_31.lines.slice(0, 1),
			isaiah40_31.lines.slice(1)
		]);
	});

	it('accepts several saved breaks in any order', () => {
		const saved = [breakAfter(john3_16, 16), breakAfter(john3_16, 5)];
		expect(parts(john3_16, saved)).toEqual([
			'For God so loved the world',
			'that He gave His one and only Son, that everyone who',
			'believes in Him shall not perish but have eternal life.'
		]);
	});
});

describe('every word appears in exactly one unit, in order', () => {
	const verses = [
		john3_16,
		romans8_38,
		romans8_39,
		hebrews1_3,
		ephesians1_3,
		ephesiansStyle,
		psalm23_4,
		isaiah40_31,
		psalm46_7
	];

	// Small seeded generator so failures reproduce.
	let seed = 12345;
	const random = () => {
		seed = (seed * 1103515245 + 12345) % 2 ** 31;
		return seed / 2 ** 31;
	};

	const unitWords = (v: Verse, saved?: Break[]) =>
		splitUnits(v, saved).units.flatMap((u) => verseWords({ ...v, lines: u.lines }));

	it.each(verses.map((v) => [v.ref, v] as const))('automatic breaks: %o', (_, v) => {
		expect(unitWords(v)).toEqual(verseWords(v));
	});

	it.each(verses.map((v) => [v.ref, v] as const))('random saved breaks: %o', (_, v) => {
		const count = verseWords(v).length;
		for (let trial = 0; trial < 50; trial++) {
			const saved: Break[] = [];
			for (let after = 0; after < count - 1; after++) {
				if (random() < 0.15) saved.push(breakAfter(v, after));
			}
			const { units, stale } = splitUnits(v, saved);
			expect(stale).toBe(false);
			expect(units).toHaveLength(saved.length === 0 ? 1 : saved.length + 1);
			expect(unitWords(v, saved)).toEqual(verseWords(v));
		}
	});
});
