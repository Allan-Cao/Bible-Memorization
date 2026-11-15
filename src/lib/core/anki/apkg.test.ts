import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import { beforeAll, describe, expect, it } from 'vitest';
import type { DeckBuild, NoteSpec } from '../model.ts';
import { ankiDeckId, writeApkg } from './apkg.ts';
import { MODEL_ID, noteTypeJson } from './notetype.ts';

const sqlDist = dirname(createRequire(import.meta.url).resolve('sql.js'));
let SQL: SqlJsStatic;
beforeAll(async () => {
	SQL = await initSqlJs({ locateFile: (file) => join(sqlDist, file) });
});

function note(order: number, overrides: Partial<NoteSpec> = {}): NoteSpec {
	return {
		guid: `bm1:k3f9x2ab:bsb:JHN.3.${16 + order}:0`,
		order,
		tags: ['bm::k3f9x2ab::r1'],
		fields: {
			Reference: `John 3:${16 + order}`,
			Context: order === 0 ? '' : `<div class="line">previous ${order}</div>`,
			Answer: `<div class="line"><span class="vn">${16 + order}</span>answer ${order}</div>`,
			Hint: `a${order}`,
			Info: 'BSB'
		},
		...overrides
	};
}

function build(overrides: Partial<DeckBuild> = {}): DeckBuild {
	return {
		deckId: 'k3f9x2ab',
		deckName: 'Memory Verses',
		notes: [note(0), note(1), note(2)],
		exportedAt: 1_800_000_000,
		...overrides
	};
}

function open(bytes: Uint8Array): { files: Record<string, Uint8Array>; db: Database } {
	const files = unzipSync(bytes);
	return { files, db: new SQL.Database(files['collection.anki2']) };
}

function rows(db: Database, sql: string): Record<string, unknown>[] {
	const [result] = db.exec(sql);
	if (!result) return [];
	return result.values.map((v) => Object.fromEntries(result.columns.map((c, i) => [c, v[i]])));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

function col(
	db: Database
): Record<string, unknown> & Record<'models' | 'decks' | 'dconf' | 'conf', Json> {
	const [row] = rows(db, 'SELECT * FROM col');
	return {
		...row,
		models: JSON.parse(row.models as string),
		decks: JSON.parse(row.decks as string),
		dconf: JSON.parse(row.dconf as string),
		conf: JSON.parse(row.conf as string)
	};
}

describe('writeApkg package', () => {
	it('is a zip with collection.anki2 and an empty media map', () => {
		const { files } = open(writeApkg(build(), SQL));
		expect(Object.keys(files).sort()).toEqual(['collection.anki2', 'media']);
		expect(strFromU8(files.media)).toBe('{}');
	});

	it('holds a schema version 11 collection with the Anki tables', () => {
		const { db } = open(writeApkg(build(), SQL));
		expect(col(db).ver).toBe(11);
		const tables = rows(db, "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name");
		expect(tables.map((t) => t.name)).toEqual(['cards', 'col', 'graves', 'notes', 'revlog']);
	});

	it('stores the note type under its fixed id', () => {
		const { db } = open(writeApkg(build(), SQL));
		const { models, decks } = col(db);
		expect(Object.keys(models)).toEqual([String(MODEL_ID)]);
		const deckId = Number(Object.keys(decks).find((id) => id !== '1'));
		expect(models[MODEL_ID]).toEqual(noteTypeJson(deckId));
	});
});

describe('writeApkg deck', () => {
	it('derives a stable numeric deck id from the deck id', () => {
		const id = ankiDeckId('k3f9x2ab');
		expect(Number.isSafeInteger(id)).toBe(true);
		expect(id).toBeGreaterThan(1);
		expect(ankiDeckId('k3f9x2ab')).toBe(id);
		expect(ankiDeckId('k3f9x2ac')).not.toBe(id);
		expect(ankiDeckId('')).toBeGreaterThan(1);
	});

	it('writes one flat deck with the build name next to Default', () => {
		const { db } = open(writeApkg(build({ deckName: 'Romans Road' }), SQL));
		const { decks, conf } = col(db);
		const id = ankiDeckId('k3f9x2ab');
		expect(Object.keys(decks).sort()).toEqual(['1', String(id)].sort());
		expect(decks[id]).toMatchObject({ id, name: 'Romans Road', dyn: 0, conf: 1 });
		expect(conf.curDeck).toBe(id);
	});

	it('keeps the deck id when the name changes', () => {
		const a = col(open(writeApkg(build({ deckName: 'A' }), SQL)).db).decks;
		const b = col(open(writeApkg(build({ deckName: 'B' }), SQL)).db).decks;
		expect(Object.keys(a)).toEqual(Object.keys(b));
	});
});

describe('writeApkg notes', () => {
	const notesOf = (b: DeckBuild) =>
		rows(open(writeApkg(b, SQL)).db, 'SELECT * FROM notes ORDER BY id');

	it('writes one note per NoteSpec with the guid exactly as given', () => {
		const notes = notesOf(build());
		expect(notes.map((n) => n.guid)).toEqual([
			'bm1:k3f9x2ab:bsb:JHN.3.16:0',
			'bm1:k3f9x2ab:bsb:JHN.3.17:0',
			'bm1:k3f9x2ab:bsb:JHN.3.18:0'
		]);
		expect(notes.every((n) => n.mid === MODEL_ID)).toBe(true);
	});

	it('uses the export time as every note modification time', () => {
		const notes = notesOf(build({ exportedAt: 1_812_345_678 }));
		expect(notes.map((n) => n.mod)).toEqual([1_812_345_678, 1_812_345_678, 1_812_345_678]);
	});

	it('writes tags space separated with surrounding spaces', () => {
		const [n] = notesOf(build({ notes: [note(0, { tags: ['bm::k3f9x2ab::r7', 'Psalm_23'] })] }));
		expect(n.tags).toBe(' bm::k3f9x2ab::r7 Psalm_23 ');
	});

	it('writes no tags as an empty string', () => {
		const [n] = notesOf(build({ notes: [note(0, { tags: [] })] }));
		expect(n.tags).toBe('');
	});

	it('rejects tags containing whitespace', () => {
		expect(() => writeApkg(build({ notes: [note(0, { tags: ['two words'] })] }), SQL)).toThrow(
			/tag/i
		);
	});

	it('rejects duplicate guids', () => {
		expect(() =>
			writeApkg(build({ notes: [note(0), note(1, { guid: note(0).guid })] }), SQL)
		).toThrow(/guid/i);
	});

	it('stores field HTML unchanged in field order', () => {
		const fields = {
			Reference: 'Psalm 23:1',
			Context: '<div class="line i1 para">&lt;prev&gt; &amp; “quotes”</div>',
			Answer:
				'<div class="line"><span class="vn">1</span>The LORD is my shepherd;</div>\n<div class="line i1">I shall not want.</div>',
			Hint: 'T L i m s; I s n w.',
			Info: 'BSB <i>notice</i>'
		};
		const [n] = notesOf(build({ notes: [note(0, { fields })] }));
		expect(n.flds).toBe(
			[fields.Reference, fields.Context, fields.Answer, fields.Hint, fields.Info].join('\x1f')
		);
	});

	it('uses Reference as the sort field', () => {
		const [n] = notesOf(build({ notes: [note(0)] }));
		expect(n.sfld).toBe('John 3:16');
	});
});

describe('writeApkg cards', () => {
	const cardsOf = (b: DeckBuild) =>
		rows(open(writeApkg(b, SQL)).db, 'SELECT * FROM cards ORDER BY id');

	it('writes one new card per note in the deck', () => {
		const { db } = open(writeApkg(build(), SQL));
		const cards = rows(db, 'SELECT * FROM cards ORDER BY id');
		const notes = rows(db, 'SELECT id FROM notes ORDER BY id');
		expect(cards.map((c) => c.nid)).toEqual(notes.map((n) => n.id));
		for (const c of cards) {
			expect(c).toMatchObject({
				did: ankiDeckId('k3f9x2ab'),
				ord: 0,
				type: 0,
				queue: 0,
				ivl: 0,
				reps: 0,
				lapses: 0,
				odid: 0,
				mod: 1_800_000_000
			});
		}
	});

	it('sets due to the note order', () => {
		const notes = [note(0, { order: 5 }), note(1, { order: 0 }), note(2, { order: 2 })];
		const { db } = open(writeApkg(build({ notes }), SQL));
		const due = rows(db, 'SELECT n.guid, c.due FROM cards c JOIN notes n ON n.id = c.nid');
		expect(Object.fromEntries(due.map((r) => [r.guid, r.due]))).toEqual({
			[notes[0].guid]: 5,
			[notes[1].guid]: 0,
			[notes[2].guid]: 2
		});
	});

	it('assigns note and card ids increasing in order, whatever the input order', () => {
		const notes = [note(0, { order: 2 }), note(1, { order: 0 }), note(2, { order: 1 })];
		const { db } = open(writeApkg(build({ notes }), SQL));
		const byNote = rows(
			db,
			'SELECT n.id AS nid, c.id AS cid, c.due FROM notes n JOIN cards c ON n.id = c.nid ORDER BY n.id'
		);
		expect(byNote.map((r) => r.due)).toEqual([0, 1, 2]);
		const byCard = rows(db, 'SELECT due FROM cards ORDER BY id');
		expect(byCard.map((r) => r.due)).toEqual([0, 1, 2]);
	});

	it('derives ids only from export time and order', () => {
		const a = cardsOf(build({ exportedAt: 1_800_000_000 }));
		const b = cardsOf(build({ exportedAt: 1_800_000_000, deckName: 'Other' }));
		const c = cardsOf(build({ exportedAt: 1_800_000_001 }));
		expect(a.map((r) => [r.id, r.nid])).toEqual(b.map((r) => [r.id, r.nid]));
		expect(c.map((r) => r.id)).not.toEqual(a.map((r) => r.id));
		expect(a.every((r) => Number.isSafeInteger(r.id) && (r.id as number) > 1e12)).toBe(true);
	});

	it('rejects duplicate orders', () => {
		expect(() => writeApkg(build({ notes: [note(0), note(1, { order: 0 })] }), SQL)).toThrow(
			/order/i
		);
	});
});

describe('writeApkg determinism', () => {
	it('gives identical bytes for the same build', () => {
		expect(writeApkg(build(), SQL)).toEqual(writeApkg(build(), SQL));
	});

	it('does not depend on the current time', () => {
		const realNow = Date.now;
		try {
			const a = writeApkg(build(), SQL);
			Date.now = () => realNow() + 86_400_000 * 400;
			expect(writeApkg(build(), SQL)).toEqual(a);
		} finally {
			Date.now = realNow;
		}
	});
});
