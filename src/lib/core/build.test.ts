import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { buildDeck, type LoadBooks } from './build.ts';
import type { BookId, BookText, DeckDefinition } from './model.ts';

/** Reads the committed text under static/text/, as the app fetches it. */
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
		name: 'Memory Verses',
		translation: 'bsb',
		list: '',
		breaks: {},
		revision: 4,
		...overrides
	};
}

describe('buildDeck', () => {
	it('builds notes for every reference, in list order', async () => {
		const def = deck({ list: '# Gospel\nJohn 3:16-17\n# Love\nRomans 8:39' });
		const result = await buildDeck(def, fromDisk, 1_800_000_000);
		expect(result.errors).toEqual([]);
		expect(result.groups.map((g) => [g.heading, g.refs.map((r) => r.label)])).toEqual([
			['Gospel', ['John 3:16-17']],
			['Love', ['Romans 8:39']]
		]);
		expect(result.passages.map((p) => p.ref.label)).toEqual(['John 3:16-17', 'Romans 8:39']);
		expect(result.build.notes.map((n) => [n.order, n.fields.Reference])).toEqual([
			[0, 'John 3:16'],
			[1, 'John 3:17'],
			[2, 'Romans 8:39']
		]);
		expect(result.build.notes[0].fields.Answer).toContain('For God so loved the world');
	});

	it('fills the build from the definition and the export time', async () => {
		const result = await buildDeck(
			deck({ name: '  Parent::Child  ', list: 'John 3:16' }),
			fromDisk,
			1_800_000_000
		);
		expect(result.build.deckId).toBe('k3x9');
		expect(result.build.deckName).toBe('Parent:Child');
		expect(result.build.exportedAt).toBe(1_800_000_000);
	});

	it('reports invalid lines and still builds the valid ones', async () => {
		const result = await buildDeck(
			deck({ list: 'John 3:16\nJohn 99\nNotabook 1' }),
			fromDisk,
			1_800_000_000
		);
		expect(result.errors.map((e) => e.line)).toEqual([2, 3]);
		expect(result.build.notes.map((n) => n.fields.Reference)).toEqual(['John 3:16']);
	});

	it('loads each needed book once, in the deck translation', async () => {
		const calls: [string, BookId[]][] = [];
		const spy: LoadBooks = (translation, ids) => {
			calls.push([translation, ids]);
			return fromDisk(translation, ids);
		};
		const result = await buildDeck(
			deck({ translation: 'kjv', list: 'John 3:16\nPsalm 23:1\nJohn 1:1' }),
			spy,
			1_800_000_000
		);
		expect(calls).toEqual([['kjv', ['JHN', 'PSA']]]);
		expect(result.passages.every((p) => p.translation === 'kjv')).toBe(true);
		expect(result.build.notes[0].fields.Info).toBe('John 3:16 · KJV');
	});

	it('uses the translation versification, so an omitted verse is in range', async () => {
		const result = await buildDeck(deck({ list: 'Matthew 17:21' }), fromDisk, 1_800_000_000);
		expect(result.errors).toEqual([]);
		expect(result.passages[0].verses[0].omitted).toBe(true);
		expect(result.build.notes).toEqual([]);
	});

	it('reports saved breaks that no longer match the text', async () => {
		const def = deck({
			list: 'John 3:16-17',
			breaks: { 'JHN.3.16': [{ after: 3, word: 'nothere' }] }
		});
		const result = await buildDeck(def, fromDisk, 1_800_000_000);
		expect(result.staleBreaks).toEqual(['JHN.3.16']);
	});

	it('does not change the definition', async () => {
		const def = deck({ list: 'John 3:16' });
		const copy = structuredClone(def);
		await buildDeck(def, fromDisk, 1_800_000_000);
		expect(def).toEqual(copy);
	});

	it('builds an empty deck from an empty list', async () => {
		const result = await buildDeck(deck(), fromDisk, 1_800_000_000);
		expect(result.build.notes).toEqual([]);
		expect(result.groups).toEqual([]);
	});
});
