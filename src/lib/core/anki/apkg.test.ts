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
