/**
 * Writes a DeckBuild as a legacy Anki package (.apkg): a zip holding `collection.anki2`
 * (SQLite, collection schema 11) and a `media` file with `{}`.
 *
 * Re-import contract: Anki matches incoming notes to existing ones by guid. With the default
 * import options ("update notes: if newer"), a note whose `mod` is later than the copy in the
 * collection has its fields and tags replaced in place, and its cards keep their scheduling.
 * So guids must be stable and every note's `mod` is the export time.
 *
 * Verified with Anki 26.09 (scripts/anki-import-check.py): Anki matches the deck by name and
 * gives it its own id, so the numeric deck id written here only has to be unique in the package.
 * A renamed deck becomes a second deck: existing cards stay where they are, new cards go to the
 * new name. Existing cards are never touched on import, so an existing new card keeps the `due`
 * it was first imported with even if its `order` changes in a later export.
 *
 * The writer is pure: the same build gives the same bytes. It takes the initialized sql.js module
 * so the core never loads WASM itself.
 */
import { strToU8, zipSync } from 'fflate';
import type { Database, SqlJsStatic } from 'sql.js';
import type { DeckBuild, NoteSpec } from '../model.ts';
import { FIELD_NAMES, MODEL_ID, noteTypeJson } from './notetype.ts';

const SCHEMA = `
CREATE TABLE col (
	id integer primary key, crt integer not null, mod integer not null, scm integer not null,
	ver integer not null, dty integer not null, usn integer not null, ls integer not null,
	conf text not null, models text not null, decks text not null, dconf text not null,
	tags text not null
);
CREATE TABLE notes (
	id integer primary key, guid text not null, mid integer not null, mod integer not null,
	usn integer not null, tags text not null, flds text not null, sfld integer not null,
	csum integer not null, flags integer not null, data text not null
);
CREATE TABLE cards (
	id integer primary key, nid integer not null, did integer not null, ord integer not null,
	mod integer not null, usn integer not null, type integer not null, queue integer not null,
	due integer not null, ivl integer not null, factor integer not null, reps integer not null,
	lapses integer not null, left integer not null, odue integer not null, odid integer not null,
	flags integer not null, data text not null
);
CREATE TABLE revlog (
	id integer primary key, cid integer not null, usn integer not null, ease integer not null,
	ivl integer not null, lastIvl integer not null, factor integer not null, time integer not null,
	type integer not null
);
CREATE TABLE graves (usn integer not null, oid integer not null, type integer not null);
CREATE INDEX ix_notes_usn on notes (usn);
CREATE INDEX ix_cards_usn on cards (usn);
CREATE INDEX ix_revlog_usn on revlog (usn);
CREATE INDEX ix_cards_nid on cards (nid);
CREATE INDEX ix_cards_sched on cards (did, queue, due);
CREATE INDEX ix_revlog_cid on revlog (cid);
CREATE INDEX ix_notes_csum on notes (csum);
`;

const DEFAULT_DECK_ID = 1;
const DEFAULT_CONF_ID = 1;

/**
 * Numeric Anki deck id for a DeckDefinition id: a 53-bit string hash (cyrb53) folded into
 * [2^40, 2^41), well away from the Default deck (1) and from millisecond-timestamp ids.
 */
export function ankiDeckId(deckId: string): number {
	let h1 = 0xdeadbeef;
	let h2 = 0x41c6ce57;
	for (let i = 0; i < deckId.length; i++) {
		const ch = deckId.charCodeAt(i);
		h1 = Math.imul(h1 ^ ch, 2654435761);
		h2 = Math.imul(h2 ^ ch, 1597334677);
	}
	h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
	h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
	const hash = 4294967296 * (2097151 & h2) + (h1 >>> 0);
	return 2 ** 40 + (hash % 2 ** 40);
}

function deckJson(id: number, name: string, mod: number) {
	return {
		id,
		name,
		mod,
		usn: -1,
		desc: '',
		dyn: 0,
		conf: DEFAULT_CONF_ID,
		collapsed: false,
		browserCollapsed: false,
		extendNew: 0,
		extendRev: 0,
		newToday: [0, 0],
		revToday: [0, 0],
		lrnToday: [0, 0],
		timeToday: [0, 0]
	};
}

function deckConfJson() {
	return {
		id: DEFAULT_CONF_ID,
		name: 'Default',
		mod: 0,
		usn: 0,
		maxTaken: 60,
		autoplay: true,
		timer: 0,
		replayq: true,
		dyn: false,
		new: {
			bury: false,
			delays: [1, 10],
			initialFactor: 2500,
			ints: [1, 4, 0],
			order: 1,
			perDay: 20
		},
		rev: { bury: false, ease4: 1.3, ivlFct: 1, maxIvl: 36500, perDay: 200, hardFactor: 1.2 },
		lapse: { delays: [10], leechAction: 1, leechFails: 8, minInt: 1, mult: 0 }
	};
}

function writeCollection(db: Database, build: DeckBuild): void {
	const t = build.exportedAt;
	const did = ankiDeckId(build.deckId);
	const conf = {
		activeDecks: [did],
		curDeck: did,
		curModel: MODEL_ID,
		newSpread: 0,
		nextPos: build.notes.length,
		sortType: 'noteFld',
		sortBackwards: false,
		addToCur: true,
		collapseTime: 1200,
		timeLim: 0,
		estTimes: true,
		dueCounts: true,
		schedVer: 2
	};
	const decks = {
		[DEFAULT_DECK_ID]: deckJson(DEFAULT_DECK_ID, 'Default', t),
		[did]: deckJson(did, build.deckName, t)
	};
	db.run('INSERT INTO col VALUES (1, ?, ?, ?, 11, 0, 0, 0, ?, ?, ?, ?, ?)', [
		t,
		t * 1000,
		t * 1000,
		JSON.stringify(conf),
		JSON.stringify({ [MODEL_ID]: noteTypeJson(did) }),
		JSON.stringify(decks),
		JSON.stringify({ [DEFAULT_CONF_ID]: deckConfJson() }),
		'{}'
	]);
}

/** Sort field text: the Reference with any markup removed, as Anki stores it. */
function sortField(html: string): string {
	return html
		.replace(/<[^>]*>/g, '')
		.replace(/&nbsp;/g, ' ')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&amp;/g, '&')
		.trim();
}

function formatTags(tags: string[]): string {
	for (const tag of tags) {
		if (tag === '' || /\s/.test(tag)) throw new Error(`Invalid tag ${JSON.stringify(tag)}`);
	}
	return tags.length ? ` ${tags.join(' ')} ` : '';
}

function validate(notes: NoteSpec[]): void {
	const guids = new Set<string>();
	const orders = new Set<number>();
	for (const n of notes) {
		if (guids.has(n.guid)) throw new Error(`Duplicate guid ${n.guid}`);
		if (!Number.isSafeInteger(n.order) || n.order < 0) throw new Error(`Invalid order ${n.order}`);
		if (orders.has(n.order)) throw new Error(`Duplicate order ${n.order}`);
		guids.add(n.guid);
		orders.add(n.order);
	}
}

/**
 * Note and card ids are `exportedAt * 1000 + order`: millisecond-style like Anki's own ids,
 * increasing in order, and the same for the same build. They only need to be unique within the
 * package; Anki matches notes by guid and gives an incoming note a fresh id if its id is taken.
 */
function writeNotes(db: Database, build: DeckBuild): void {
	validate(build.notes);
	const t = build.exportedAt;
	const did = ankiDeckId(build.deckId);
	const notes = [...build.notes].sort((a, b) => a.order - b.order);
	const insertNote = db.prepare("INSERT INTO notes VALUES (?, ?, ?, ?, -1, ?, ?, ?, 0, 0, '')");
	const insertCard = db.prepare(
		"INSERT INTO cards VALUES (?, ?, ?, 0, ?, -1, 0, 0, ?, 0, 0, 0, 0, 0, 0, 0, 0, '')"
	);
	try {
		for (const n of notes) {
			const id = t * 1000 + n.order;
			const flds = FIELD_NAMES.map((name) => n.fields[name]).join('\x1f');
			insertNote.run([
				id,
				n.guid,
				MODEL_ID,
				t,
				formatTags(n.tags),
				flds,
				sortField(n.fields.Reference)
			]);
			insertCard.run([id, id, did, t, n.order]);
		}
	} finally {
		insertNote.free();
		insertCard.free();
	}
}

export function writeApkg(build: DeckBuild, SQL: SqlJsStatic): Uint8Array {
	const db = new SQL.Database();
	let collection: Uint8Array;
	try {
		db.run(SCHEMA);
		writeCollection(db, build);
		writeNotes(db, build);
		collection = db.export();
	} finally {
		db.close();
	}
	const mtime = new Date(build.exportedAt * 1000);
	return zipSync(
		{
			'collection.anki2': [collection, { mtime }],
			media: [strToU8('{}'), { mtime }]
		},
		{ level: 6 }
	);
}
