import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { unzipSync } from 'fflate';
import initSqlJs from 'sql.js';
import { describe, expect, it } from 'vitest';
import { writeApkg } from './anki/apkg.ts';
import { buildDeck, type LoadBooks } from './build.ts';
import type { BookId, BookText, DeckDefinition, NoteSpec, TranslationId } from './model.ts';
import { verseKey } from './refs.ts';
import { splitUnits } from './units.ts';

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

describe('presets end to end', () => {
	it.each(['nt.txt', 'ot.txt'])('%s builds and writes a package Anki can read', async (file) => {
		const list = await readFile(new URL(`../../../presets/${file}`, import.meta.url), 'utf8');
		const { build, errors, passages } = await buildDeck(deck({ list }), fromDisk, 1_800_000_000);
		expect(errors).toEqual([]);

		// Each verse is asked once, however many passages contain it.
		const verses = new Map(passages.flatMap((p) => p.verses.map((v) => [verseKey(v.ref), v])));
		const units = [...verses.values()].reduce((n, v) => n + splitUnits(v).units.length, 0);

		const sqlDist = dirname(createRequire(import.meta.url).resolve('sql.js'));
		const SQL = await initSqlJs({ locateFile: (f) => join(sqlDist, f) });
		const db = new SQL.Database(unzipSync(writeApkg(build, SQL))['collection.anki2']);
		const rows = db.exec(
			'SELECT n.guid, c.due FROM notes n JOIN cards c ON c.nid = n.id ORDER BY n.id'
		)[0].values as [string, number][];
		db.close();

		expect(rows.length).toBe(units);
		expect(new Set(rows.map(([guid]) => guid)).size).toBe(rows.length);
		expect(rows.map(([guid]) => guid)).toEqual(build.notes.map((n) => n.guid));
		expect(rows.map(([, due]) => due)).toEqual(rows.map((_, i) => i));
	});
});

// ---------------------------------------------------------------------------------------------
// Golden cards: real text, built as an export would be, written out for a person to judge.

/**
 * Field HTML as text. Each printed line sits right of a `│`, so its indent shows: 4 spaces per
 * level. A verse number stands left of the `│`; a bare `│` line is a paragraph or stanza gap.
 */
function lines(html: string): string[] {
	const out: string[] = [];
	for (const [, classes, inner] of html.matchAll(/<div class="line([^"]*)">(.*?)<\/div>/g)) {
		if (out.length > 0 && classes.includes('para')) out.push(`${''.padEnd(4)} │`);
		const vn = /^<span class="vn">(\d+)<\/span>/.exec(inner);
		const body = inner
			.replace(/^<span class="vn">\d+<\/span>/, '')
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/&quot;/g, '"')
			.replace(/&amp;/g, '&');
		const indent = '    '.repeat(Number(/i(\d)/.exec(classes)?.[1] ?? 0));
		out.push(`${(vn?.[1] ?? '').padStart(4)} │ ${indent}${body}`);
	}
	return out;
}

function describeNote(note: NoteSpec): string {
	const block = (label: string, html: string) => {
		const body = lines(html);
		if (body.length === 0) return `${label.padEnd(15)}(none)`;
		return body.map((line, i) => (i === 0 ? label : '').padEnd(8) + line).join('\n');
	};
	return [
		`── ${note.order + 1}. ${note.fields.Reference} `.padEnd(72, '─'),
		block('Lead-in', note.fields.Context),
		block('Answer', note.fields.Answer),
		block('Hint', note.fields.Hint),
		`${'Info'.padEnd(15)}${note.fields.Info}`,
		`${'GUID'.padEnd(15)}${note.guid}`
	].join('\n');
}

const GOLDEN: [file: string, ref: string][] = [
	['psalm-23', 'Psalm 23'],
	['romans-8-38-39', 'Romans 8:38-39'],
	['john-3-16-17', 'John 3:16-17'],
	['proverbs-3-5-6', 'Proverbs 3:5-6'],
	['hebrews-1-1-4', 'Hebrews 1:1-4'],
	['isaiah-40-28-31', 'Isaiah 40:28-31'],
	['john-14-1-3-6', 'John 14:1-3, 6'],
	['james-1-2-4', 'James 1:2-4'],
	['matthew-17-20-22', 'Matthew 17:20-22'],
	['psalm-51-1-4', 'Psalm 51:1-4'],
	['psalm-46', 'Psalm 46'],
	['revelation-20-4-6', 'Revelation 20:4-6'],
	['ephesians-1-3-14', 'Ephesians 1:3-14']
];

describe.each(['bsb', 'web', 'kjv'] as TranslationId[])('golden cards: %s', (translation) => {
	it.each(GOLDEN)('%s', async (file, ref) => {
		const def = deck({ id: 'golden', translation, list: ref });
		const { build, errors, passages } = await buildDeck(def, fromDisk, 1_800_000_000);
		expect(errors).toEqual([]);
		const body = build.notes.map(describeNote).join('\n\n');
		await expect(
			`${passages[0].ref.label} (${translation.toUpperCase()})\n\n${body}\n`
		).toMatchFileSnapshot(`../../../tests/golden/cards/${translation}/${file}.txt`);
	});
});
