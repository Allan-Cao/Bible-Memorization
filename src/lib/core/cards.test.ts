import { describe, expect, it } from 'vitest';
import { makeNotes, noteGuid } from './cards.ts';
import type { DeckDefinition, Line, NoteSpec, Passage, Verse } from './model.ts';
import { breakAfter } from './units.ts';

// ---- Builders -------------------------------------------------------------------------------

const prose = (book: string, chapter: number, verse: number, text: string): Verse => ({
	ref: { book, chapter, verse },
	lines: [{ text, indent: 0 }]
});

/** Poetry: the first line at indent 0, the rest at indent 1. */
const poem = (
	book: string,
	chapter: number,
	verse: number,
	texts: string[],
	extra: { title?: string; stanza?: boolean } = {}
): Verse => ({
	ref: { book, chapter, verse },
	lines: texts.map((text, i): Line => {
		const line: Line = { text, indent: i === 0 ? 0 : 1 };
		if (i === 0 && extra.stanza) line.paragraph = true;
		return line;
	}),
	...(extra.title ? { title: extra.title } : {})
});

/** `ranges` as [chapter, fromVerse, toVerse] within `book`. */
const passage = (
	label: string,
	book: string,
	ranges: [number, number, number][],
	verses: Verse[]
): Passage => ({
	ref: {
		label,
		ranges: ranges.map(([chapter, from, to]) => ({
			start: { book, chapter, verse: from },
			end: { book, chapter, verse: to }
		}))
	},
	translation: 'bsb',
	verses
});

const deck = (extra: Partial<DeckDefinition> = {}): DeckDefinition => ({
	v: 1,
	id: 'k3x9',
	name: 'Test deck',
	translation: 'bsb',
	list: '',
	breaks: {},
	revision: 1,
	...extra
});

// ---- BSB text -------------------------------------------------------------------------------

const psalm23 = passage(
	'Psalm 23',
	'PSA',
	[[23, 1, 6]],
	[
		poem('PSA', 23, 1, ['The LORD is my shepherd;', 'I shall not want.'], {
			title: 'A Psalm of David.',
			stanza: true
		}),
		poem('PSA', 23, 2, [
			'He makes me lie down in green pastures;',
			'He leads me beside quiet waters.'
		]),
		poem('PSA', 23, 3, [
			'He restores my soul;',
			'He guides me in the paths of righteousness',
			'for the sake of His name.'
		]),
		poem('PSA', 23, 4, [
			'Even though I walk through the valley of the shadow of death,',
			'I will fear no evil,',
			'for You are with me;',
			'Your rod and Your staff, they comfort me.'
		]),
		poem('PSA', 23, 5, [
			'You prepare a table before me',
			'in the presence of my enemies.',
			'You anoint my head with oil;',
			'my cup overflows.'
		]),
		poem('PSA', 23, 6, [
			'Surely goodness and loving devotion shall follow me',
			'all the days of my life,',
			'and I will dwell in the house of the LORD',
			'forever.'
		])
	]
);

const romans8 = passage(
	'Romans 8:38-39',
	'ROM',
	[[8, 38, 39]],
	[
		prose(
			'ROM',
			8,
			38,
			'For I am convinced that neither death nor life, neither angels nor principalities, neither the present nor the future, nor any powers,'
		),
		prose(
			'ROM',
			8,
			39,
			'neither height nor depth, nor anything else in all creation, will be able to separate us from the love of God that is in Christ Jesus our Lord.'
		)
	]
);

const john3_16 = prose(
	'JHN',
	3,
	16,
	'For God so loved the world that He gave His one and only Son, that everyone who believes in Him shall not perish but have eternal life.'
);
const john3_17 = prose(
	'JHN',
	3,
	17,
	'For God did not send His Son into the world to condemn the world, but to save the world through Him.'
);
const john3 = passage('John 3:16-17', 'JHN', [[3, 16, 17]], [john3_16, john3_17]);

const proverbs3 = passage(
	'Proverbs 3:5-6',
	'PRO',
	[[3, 5, 6]],
	[
		poem(
			'PRO',
			3,
			5,
			['Trust in the LORD with all your heart,', 'and lean not on your own understanding;'],
			{
				stanza: true
			}
		),
		poem('PRO', 3, 6, [
			'in all your ways acknowledge Him,',
			'and He will make your paths straight.'
		])
	]
);

const hebrews1 = passage(
	'Hebrews 1:2-4',
	'HEB',
	[[1, 2, 4]],
	[
		prose(
			'HEB',
			1,
			2,
			'But in these last days He has spoken to us by His Son, whom He appointed heir of all things, and through whom He made the universe.'
		),
		prose(
			'HEB',
			1,
			3,
			'The Son is the radiance of God’s glory and the exact representation of His nature, upholding all things by His powerful word. After He had provided purification for sins, He sat down at the right hand of the Majesty on high.'
		),
		prose(
			'HEB',
			1,
			4,
			'So He became as far superior to the angels as the name He has inherited is excellent beyond theirs.'
		)
	]
);

const john14 = passage(
	'John 14:1-3, 6',
	'JHN',
	[
		[14, 1, 3],
		[14, 6, 6]
	],
	[
		prose(
			'JHN',
			14,
			1,
			'Do not let your hearts be troubled. You believe in God; believe in Me as well.'
		),
		prose(
			'JHN',
			14,
			2,
			'In My Father’s house are many rooms. If it were not so, would I have told you that I am going there to prepare a place for you?'
		),
		prose(
			'JHN',
			14,
			3,
			'And if I go and prepare a place for you, I will come back and welcome you into My presence, so that you also may be where I am.'
		),
		prose(
			'JHN',
			14,
			6,
			'Jesus answered, “I am the way and the truth and the life. No one comes to the Father except through Me.'
		)
	]
);

// ---- Helpers --------------------------------------------------------------------------------

const notes = (def: DeckDefinition, passages: Passage[]) => makeNotes(def, passages).notes;
const field = (key: keyof NoteSpec['fields'], def: DeckDefinition, passages: Passage[]) =>
	notes(def, passages).map((n) => n.fields[key]);
const guidOf = (def: DeckDefinition, passages: Passage[], key: string, unit = 0) =>
	notes(def, passages).find((n) => n.guid.endsWith(`:${key}:${unit}`))?.guid;

/** Field HTML as plain text: one line per `.line`, 4 spaces per indent level, `[N]` verse numbers. */
function text(html: string): string {
	const lines = [...html.matchAll(/<div class="line([^"]*)">(.*?)<\/div>/g)];
	return lines
		.map(([, classes, inner], i) => {
			const indent = '    '.repeat(Number(/i(\d)/.exec(classes)?.[1] ?? 0));
			const gap = i > 0 && classes.includes('para') ? '\n' : '';
			const body = inner
				.replace(/<span class="vn">(\d+)<\/span>/, '[$1] ')
				.replace(/&lt;/g, '<')
				.replace(/&gt;/g, '>')
				.replace(/&quot;/g, '"')
				.replace(/&amp;/g, '&');
			return gap + indent + body;
		})
		.join('\n');
}

// ---- Tests ----------------------------------------------------------------------------------

describe('noteGuid', () => {
	it('is built from deck id, translation, verse and unit index', () => {
		expect(noteGuid('k3x9', 'bsb', { book: 'JHN', chapter: 3, verse: 16 }, 0)).toBe(
			'bm1:k3x9:bsb:JHN.3.16:0'
		);
		expect(noteGuid('k3x9', 'kjv', { book: '1JN', chapter: 4, verse: 8 }, 2)).toBe(
			'bm1:k3x9:kjv:1JN.4.8:2'
		);
	});
});

describe('makeNotes: one note per unit', () => {
	it('makes one note per verse when nothing is split, numbered across the deck', () => {
		const result = notes(deck(), [john3, romans8]);
		expect(result.map((n) => [n.order, n.fields.Reference])).toEqual([
			[0, 'John 3:16'],
			[1, 'John 3:17'],
			[2, 'Romans 8:38'],
			[3, 'Romans 8:39']
		]);
	});

	it('numbers the parts of a split verse in the reference', () => {
		expect(field('Reference', deck(), [hebrews1])).toEqual([
			'Hebrews 1:2',
			'Hebrews 1:3 (1/2)',
			'Hebrews 1:3 (2/2)',
			'Hebrews 1:4'
		]);
	});

	it('follows the single-chapter label rule: Jude 5, but Jude 1:1', () => {
		const jude = passage(
			'Jude 1',
			'JUD',
			[[1, 1, 2]],
			[
				prose('JUD', 1, 1, 'Jude, a servant of Jesus Christ and a brother of James,'),
				prose('JUD', 1, 2, 'Mercy, peace, and love be multiplied to you.')
			]
		);
		const jude5 = passage(
			'Jude 5',
			'JUD',
			[[1, 5, 5]],
			[prose('JUD', 1, 5, 'Now I want to remind you.')]
		);
		expect(field('Reference', deck(), [jude, jude5])).toEqual(['Jude 1:1', 'Jude 2', 'Jude 5']);
	});

	it('uses the book display name', () => {
		const p = passage(
			'Psalm 117',
			'PSA',
			[[117, 1, 1]],
			[prose('PSA', 117, 1, 'Praise the LORD, all you nations!')]
		);
		expect(field('Reference', deck(), [p])).toEqual(['Psalm 117:1']);
	});

	it('gives no notes for an omitted verse', () => {
		const p = passage(
			'Matthew 17:20-22',
			'MAT',
			[[17, 20, 22]],
			[
				prose('MAT', 17, 20, 'Because you have so little faith.'),
				{ ref: { book: 'MAT', chapter: 17, verse: 21 }, lines: [], omitted: true },
				prose('MAT', 17, 22, 'When they gathered together in Galilee.')
			]
		);
		expect(field('Reference', deck(), [p])).toEqual(['Matthew 17:20', 'Matthew 17:22']);
	});

	it('fills Info with the passage label and translation, and tags with deck and revision', () => {
		const [note] = notes(deck({ id: 'abc', revision: 7 }), [psalm23]);
		expect(note.fields.Info).toBe('Psalm 23 · BSB');
		expect(note.tags).toEqual(['bm::abc::r7']);
	});

	it('renders the answer with the verse number on the first unit only', () => {
		const [, first, second] = field('Answer', deck(), [hebrews1]);
		expect(first).toMatch(/^<div class="line"><span class="vn">3<\/span>The Son is/);
		expect(second).toBe(
			'<div class="line">After He had provided purification for sins, He sat down at the right hand of the Majesty on high.</div>'
		);
	});

	it('gives the first-letter hint of the unit', () => {
		expect(field('Hint', deck(), [proverbs3])[0]).toBe(
			'<div class="line">T i t L w a y h,</div><div class="line i1">a l n o y o u;</div>'
		);
	});

	it('escapes HTML in the text', () => {
		const p = passage('John 1:1', 'JHN', [[1, 1, 1]], [prose('JHN', 1, 1, 'a < b & c > d')]);
		const [note] = notes(deck(), [p]);
		expect(note.fields.Answer).toBe(
			'<div class="line"><span class="vn">1</span>a &lt; b &amp; c &gt; d</div>'
		);
	});
});

describe('makeNotes: lead-in', () => {
	const context = (passages: Passage[], def = deck()) =>
		notes(def, passages).map((n) => [n.fields.Reference, text(n.fields.Context)]);

	it('gives the first unit of a passage no lead-in, and later units the previous one', () => {
		expect(context([john3])).toEqual([
			['John 3:16', ''],
			['John 3:17', `[16] ${john3_16.lines[0].text}`]
		]);
	});

	it('holds only .line elements, with the verse marker (the template adds .context)', () => {
		const [, second] = field('Context', deck(), [john3]);
		expect(second).toBe(
			`<div class="line"><span class="vn">16</span>${john3_16.lines[0].text}</div>`
		);
	});

	it('gives no lead-in across a gap in a comma list', () => {
		expect(context([john14]).map(([ref, lead]) => [ref, lead.slice(0, 4)])).toEqual([
			['John 14:1', ''],
			['John 14:2', '[1] '],
			['John 14:3', '[2] '],
			['John 14:6', '']
		]);
	});

	it('leads into a second part with the first part, and the next verse with the last part', () => {
		expect(context([hebrews1]).slice(1)).toEqual([
			['Hebrews 1:3 (1/2)', expect.stringMatching(/^\[2\] But in these last days/)],
			[
				'Hebrews 1:3 (2/2)',
				'[3] The Son is the radiance of God’s glory and the exact representation of His nature, upholding all things by His powerful word.'
			],
			[
				'Hebrews 1:4',
				'After He had provided purification for sins, He sat down at the right hand of the Majesty on high.'
			]
		]);
	});

	it('shows the psalm title when there is no lead-in', () => {
		const [first, second] = field('Context', deck(), [psalm23]);
		expect(first).toBe('<div class="line">A Psalm of David.</div>');
		expect(second).toMatch(/^<div class="line"><span class="vn">1<\/span>The LORD/);
	});

	it('shows a psalm title instead of the lead-in from the psalm before', () => {
		const psalms: Passage = {
			ref: {
				label: 'Psalm 2-3',
				ranges: [
					{
						start: { book: 'PSA', chapter: 2, verse: 12 },
						end: { book: 'PSA', chapter: 3, verse: 2 }
					}
				]
			},
			translation: 'bsb',
			verses: [
				poem('PSA', 2, 12, ['Kiss the Son.']),
				poem('PSA', 3, 1, ['O LORD, how many are my foes!'], { title: 'A Psalm of David.' }),
				poem('PSA', 3, 2, ['Many are saying of me,'])
			]
		};
		expect(context([psalms])).toEqual([
			['Psalm 2:12', ''],
			['Psalm 3:1', 'A Psalm of David.'],
			['Psalm 3:2', '[1] O LORD, how many are my foes!']
		]);
	});

	it('leaves Selah out of a lead-in, and gives none when only Selah is left', () => {
		const selah = (text: string): Line => ({ text, indent: 0, selah: true });
		const p = passage(
			'Psalm 46:3-5',
			'PSA',
			[[46, 3, 5]],
			[
				{
					ref: { book: 'PSA', chapter: 46, verse: 3 },
					lines: [{ text: 'though its waters roar', indent: 0 }, selah('Selah')]
				},
				{ ref: { book: 'PSA', chapter: 46, verse: 4 }, lines: [selah('Selah')] },
				prose('PSA', 46, 5, 'God is within her.')
			]
		);
		const [, four, five] = notes(deck(), [p]);
		expect(text(four.fields.Context)).toBe('[3] though its waters roar');
		expect(text(four.fields.Answer)).toContain('Selah');
		expect(five.fields.Context).toBe('');
	});

	it('gives the first unit after an omitted verse no lead-in', () => {
		const p = passage(
			'Matthew 17:20-22',
			'MAT',
			[[17, 20, 22]],
			[
				prose('MAT', 17, 20, 'Because you have so little faith.'),
				{ ref: { book: 'MAT', chapter: 17, verse: 21 }, lines: [], omitted: true },
				prose('MAT', 17, 22, 'When they gathered together in Galilee.')
			]
		);
		expect(context([p])).toEqual([
			['Matthew 17:20', ''],
			['Matthew 17:22', '']
		]);
	});

	it('does not lead in from one passage to the next', () => {
		expect(context([john3, romans8])[2]).toEqual(['Romans 8:38', '']);
	});
});

describe('makeNotes: breaks', () => {
	it('looks up saved breaks by verse key', () => {
		const def = deck({ breaks: { 'JHN.3.16': [breakAfter(john3_16, 13)] } });
		expect(field('Reference', def, [john3])).toEqual([
			'John 3:16 (1/2)',
			'John 3:16 (2/2)',
			'John 3:17'
		]);
	});

	it('keeps a long verse whole when its saved breaks are empty', () => {
		expect(field('Reference', deck({ breaks: { 'HEB.1.3': [] } }), [hebrews1])).toEqual([
			'Hebrews 1:2',
			'Hebrews 1:3',
			'Hebrews 1:4'
		]);
	});

	it('reports verses whose saved breaks are stale', () => {
		const def = deck({
			breaks: {
				'JHN.3.16': [{ after: 13, word: 'Daughter,' }],
				'JHN.3.17': [breakAfter(john3_17, 13)]
			}
		});
		const result = makeNotes(def, [john3]);
		expect(result.staleBreaks).toEqual(['JHN.3.16']);
		expect(result.notes.map((n) => n.fields.Reference)).toEqual([
			'John 3:16',
			'John 3:17 (1/2)',
			'John 3:17 (2/2)'
		]);
	});
});

describe('makeNotes: duplicate verses', () => {
	it('makes notes for a verse only the first time it appears in the deck', () => {
		const john3_16only = passage('John 3:16', 'JHN', [[3, 16, 16]], [john3_16]);
		const result = notes(deck(), [john3_16only, john3]);
		expect(result.map((n) => n.fields.Reference)).toEqual(['John 3:16', 'John 3:17']);
		expect(new Set(result.map((n) => n.guid)).size).toBe(result.length);
		expect(result.map((n) => n.order)).toEqual([0, 1]);
	});

	it('still uses the skipped verse as the lead-in of the next one', () => {
		const john3_16only = passage('John 3:16', 'JHN', [[3, 16, 16]], [john3_16]);
		const [, second] = notes(deck(), [john3_16only, john3]);
		expect(text(second.fields.Context)).toBe(`[16] ${john3_16.lines[0].text}`);
		expect(second.fields.Info).toBe('John 3:16-17 · BSB');
	});
});

describe('makeNotes: GUID stability', () => {
	const key = 'JHN.3.17';
	const base = guidOf(deck(), [john3], key);

	it('is what noteGuid says', () => {
		expect(base).toBe('bm1:k3x9:bsb:JHN.3.17:0');
	});

	it('does not change when the deck is renamed or re-exported', () => {
		expect(guidOf(deck({ name: 'Renamed' }), [john3], key)).toBe(base);
		expect(guidOf(deck({ revision: 42 }), [john3], key)).toBe(base);
	});

	it('does not change when the verse text changes', () => {
		const edited = passage(
			'John 3:16-17',
			'JHN',
			[[3, 16, 17]],
			[
				john3_16,
				prose('JHN', 3, 17, 'For God sent not his Son into the world to condemn the world.')
			]
		);
		expect(guidOf(deck(), [edited], key)).toBe(base);
	});

	it('does not change when the range is extended or a passage is added before it', () => {
		const extended = passage(
			'John 3:16-18',
			'JHN',
			[[3, 16, 18]],
			[...john3.verses, prose('JHN', 3, 18, 'Whoever believes in Him is not condemned.')]
		);
		expect(guidOf(deck(), [extended], key)).toBe(base);
		expect(guidOf(deck(), [psalm23, romans8, john3], key)).toBe(base);
	});

	it('changes with the translation or the deck id', () => {
		expect(guidOf(deck({ translation: 'kjv' }), [john3], key)).toBe('bm1:k3x9:kjv:JHN.3.17:0');
		expect(guidOf(deck({ id: 'other' }), [john3], key)).toBe('bm1:other:bsb:JHN.3.17:0');
	});

	it('keeps the GUID of unit 0 when a break is added', () => {
		const def = deck({ breaks: { [key]: [breakAfter(john3_17, 13)] } });
		expect(guidOf(def, [john3], key, 0)).toBe(base);
		expect(guidOf(def, [john3], key, 1)).toBe('bm1:k3x9:bsb:JHN.3.17:1');
	});
});
