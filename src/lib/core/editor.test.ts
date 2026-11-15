import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { buildDeck, type LoadBooks } from './build.ts';
import { insertedPassages, passageCount, previewDeck, toggleBreak } from './editor.ts';
import type { BookId, BookText, DeckDefinition, Verse } from './model.ts';
import { renderLines, renderTitle } from './render.ts';
import { autoBreaks, verseWords } from './units.ts';

const fromDisk: LoadBooks = async (translation, bookIds) => {
	const entries = await Promise.all(
		bookIds.map(async (id): Promise<[BookId, BookText]> => {
			const url = new URL(`../../../static/text/${translation}/${id}.json`, import.meta.url);
			return [id, JSON.parse(await readFile(url, 'utf8'))];
		})
	);
	return Object.fromEntries(entries);
};

function deck(overrides: Partial<DeckDefinition> = {}): DeckDefinition {
	return {
		v: 1,
		id: 'k3x9',
		name: 'Test',
		translation: 'bsb',
		list: '',
		breaks: {},
		revision: 0,
		...overrides
	};
}

async function preview(def: DeckDefinition) {
	const result = await buildDeck(def, fromDisk, 1_800_000_000);
	return { result, groups: previewDeck(def, result) };
}

describe('previewDeck', () => {
	it('groups passages under their headings', async () => {
		const { groups } = await preview(
			deck({ list: 'Psalm 23:1\n# Gospel\nJohn 3:16-17\nJohn 14:6' })
		);
		expect(groups.map((g) => [g.heading, g.passages.map((p) => [p.label, p.cards])])).toEqual([
			[null, [['Psalm 23:1', 1]]],
			[
				'Gospel',
				[
					['John 3:16-17', 2],
					['John 14:6', 1]
				]
			]
		]);
	});

	it('matches the notes card for card, in both presets', async () => {
		for (const file of ['ot.txt', 'nt.txt']) {
			const list = await readFile(new URL(`../../../presets/${file}`, import.meta.url), 'utf8');
			const { result, groups } = await preview(deck({ list }));
			const cards = groups.flatMap((g) =>
				g.passages.flatMap((p) => p.verses.flatMap((v) => v.cards))
			);
			expect(cards.length).toBe(result.build.notes.length);
			cards.forEach((card, i) => {
				const fields = result.build.notes[i].fields;
				const context = !card.lead
					? ''
					: card.lead.title
						? renderTitle(card.lead.lines[0].text)
						: renderLines(card.lead.lines, card.lead.verseNumber);
				const answer = renderLines(card.unit.lines, card.verseNumber);
				expect([card.reference, context, answer]).toEqual([
					fields.Reference,
					fields.Context,
					fields.Answer
				]);
				expect(renderLines(card.hint)).toBe(fields.Hint);
			});
		}
	});

	it('gives no lead-in across a gap between ranges', async () => {
		const { groups } = await preview(deck({ list: 'John 14:1-3, 6' }));
		const verses = groups[0].passages[0].verses;
		expect(verses.map((v) => v.cards[0].lead?.verseNumber ?? null)).toEqual([null, 1, 2, null]);
	});

	it('shows a psalm title in place of the lead-in, marked as a title', async () => {
		const { groups } = await preview(deck({ list: 'Psalm 23:1' }));
		const lead = groups[0].passages[0].verses[0].cards[0].lead;
		expect(lead).toMatchObject({ title: true });
		expect(lead?.verseNumber).toBeUndefined();
		expect(lead?.lines[0].text).toMatch(/David/);
	});

	it('marks a verse already asked by an earlier passage and makes no cards for it', async () => {
		const { groups } = await preview(deck({ list: 'John 3:16\nJohn 3:16-17' }));
		const [first, second] = groups[0].passages;
		expect(first.verses[0].repeated).toBe(false);
		expect(second.verses.map((v) => [v.repeated, v.cards.length])).toEqual([
			[true, 0],
			[false, 1]
		]);
		expect(second.cards).toBe(1);
		// The repeated copy still leads in to the verse after it.
		expect(second.verses[1].cards[0].lead?.verseNumber).toBe(16);
	});

	it('reports the breaks in use and whether they were saved', async () => {
		const auto = await preview(deck({ list: 'Romans 8:38-39' }));
		const verse = auto.groups[0].passages[0].verses[0];
		expect(verse.saved).toBe(false);
		expect(verse.breaks).toEqual(autoBreaks(verse.verse));

		const words = verseWords(verse.verse);
		const breaks = [{ after: 2, word: words[2] }];
		const saved = await preview(deck({ list: 'Romans 8:38-39', breaks: { 'ROM.8.38': breaks } }));
		const v = saved.groups[0].passages[0].verses[0];
		expect([v.saved, v.breaks, v.cards.length]).toEqual([true, breaks, 2]);

		const stale = { 'ROM.8.38': [{ after: 2, word: 'not-the-word' }] };
		const s = (await preview(deck({ list: 'Romans 8:38-39', breaks: stale }))).groups[0].passages[0]
			.verses[0];
		expect([s.saved, s.breaks]).toEqual([false, autoBreaks(s.verse)]);
	});
});

const verse: Verse = {
	ref: { book: 'JHN', chapter: 3, verse: 16 },
	lines: [{ text: 'For God so loved the world', indent: 0 }]
};

describe('toggleBreak', () => {
	it('adds a break in word order', () => {
		expect(toggleBreak(verse, [{ after: 4, word: 'the' }], 1)).toEqual([
			{ after: 1, word: 'God' },
			{ after: 4, word: 'the' }
		]);
	});

	it('removes an existing break', () => {
		expect(toggleBreak(verse, [{ after: 1, word: 'God' }], 1)).toEqual([]);
	});

	it('ignores positions that are not between two words', () => {
		expect(toggleBreak(verse, [], 5)).toEqual([]);
		expect(toggleBreak(verse, [], -1)).toEqual([]);
	});
});

describe('insertedPassages', () => {
	it('lists new passages placed before a passage that was already exported', () => {
		expect(insertedPassages(['A', 'B', 'C'], ['A', 'X', 'B', 'C', 'Y'])).toEqual(['X']);
		expect(insertedPassages(['A', 'B'], ['X', 'B'])).toEqual(['X']);
	});

	it('is empty when passages are only added at the end, or on a first export', () => {
		expect(insertedPassages(['A', 'B'], ['A', 'B', 'X'])).toEqual([]);
		expect(insertedPassages(['A', 'B'], ['B', 'X'])).toEqual([]);
		expect(insertedPassages(null, ['A', 'B'])).toEqual([]);
	});
});

describe('passageCount', () => {
	it('counts the valid references, ignoring headings and mistakes', () => {
		expect(passageCount(deck({ list: '# A\nJohn 3:16\nNope 1\n\nPsalm 23' }))).toBe(2);
	});
});
