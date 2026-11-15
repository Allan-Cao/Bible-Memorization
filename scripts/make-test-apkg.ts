/**
 * Writes the packages used by scripts/anki-import-check.py into a directory, plus a manifest.json
 * describing them. Dev-only.
 *
 *   npx tsx scripts/make-test-apkg.ts <out-dir>
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { unzipSync, zipSync } from 'fflate';
import initSqlJs, { type SqlJsStatic } from 'sql.js';
import { ankiDeckId, writeApkg } from '../src/lib/core/anki/apkg.ts';
import { MODEL_ID } from '../src/lib/core/anki/notetype.ts';
import type { DeckBuild, NoteSpec } from '../src/lib/core/model.ts';

const DECK_ID = 'k3f9x2ab';
const T1 = 1_800_000_000;
const T2 = T1 + 86_400;

const tag = (deckId: string, revision: number) => `bm::${deckId}::r${revision}`;

const VERSES: Record<number, string> = {
	16: 'For God so loved the world that He gave His one and only Son,',
	17: 'For God did not send His Son into the world to condemn the world,',
	18: 'Whoever believes in Him is not condemned,',
	19: 'And this is the verdict: The Light has come into the world,',
	20: 'Everyone who does evil hates the Light,',
	21: 'But whoever practices the truth comes into the Light,'
};

function hintOf(text: string): string {
	return text
		.split(/\s+/)
		.map((w) => w.replace(/^(\W*)(\w).*?(\W*)$/, '$1$2$3'))
		.join(' ');
}

function spec(verse: number, order: number, revision: number, answer?: string): NoteSpec {
	const text = answer ?? VERSES[verse];
	return {
		guid: `bm1:${DECK_ID}:bsb:JHN.3.${verse}:0`,
		order,
		tags: [tag(DECK_ID, revision)],
		fields: {
			Reference: `John 3:${verse}`,
			Context:
				verse === 16
					? ''
					: `<div class="line"><span class="vn">${verse - 1}</span>${VERSES[verse - 1]}</div>`,
			Answer: `<div class="line"><span class="vn">${verse}</span>${text}</div>`,
			Hint: hintOf(text),
			Info: 'Berean Standard Bible'
		}
	};
}

const CHANGED_ANSWER = 'For God so loved the world, that He gave His only begotten Son (changed).';

const v1: DeckBuild = {
	deckId: DECK_ID,
	deckName: 'Import Check',
	exportedAt: T1,
	notes: [16, 17, 18, 19, 20].map((v, i) => spec(v, i, 1))
};

// v2: 16 changed, 19 removed, 21 added in the middle (between 17 and 18, so 18 moves from
// position 2 to 3), every tag moves to r2.
const v2: DeckBuild = {
	deckId: DECK_ID,
	deckName: 'Import Check',
	exportedAt: T2,
	notes: [
		spec(16, 0, 2, CHANGED_ANSWER),
		spec(17, 1, 2),
		spec(21, 2, 2),
		spec(18, 3, 2),
		spec(20, 4, 2)
	]
};

const v2Renamed: DeckBuild = { ...v2, deckName: 'Import Check Renamed' };

// Two unrelated decks whose note ids collide: 1_800_000_000 * 1000 + 1000 === 1_800_000_001 * 1000 + 0.
const collideA: DeckBuild = {
	deckId: 'collideA',
	deckName: 'Collide A',
	exportedAt: T1,
	notes: [{ ...spec(16, 1000, 1), guid: 'bm1:collideA:bsb:JHN.3.16:0', tags: [tag('collideA', 1)] }]
};
const collideB: DeckBuild = {
	deckId: 'collideB',
	deckName: 'Collide B',
	exportedAt: T1 + 1,
	notes: [{ ...spec(17, 0, 1), guid: 'bm1:collideB:bsb:JHN.3.17:0', tags: [tag('collideB', 1)] }]
};

export const TEMPLATE_MARKER = '/* template bump check */';

/** The v2 package as a later TEMPLATE_VERSION would write it: newer note type mod, changed CSS. */
function withBumpedTemplate(bytes: Uint8Array, SQL: SqlJsStatic): Uint8Array {
	const files = unzipSync(bytes);
	const db = new SQL.Database(files['collection.anki2']);
	const [[modelsJson]] = db.exec('SELECT models FROM col')[0].values as [[string]];
	const models = JSON.parse(modelsJson);
	for (const m of Object.values(models) as { mod: number; css: string }[]) {
		m.mod += 1;
		m.css += TEMPLATE_MARKER;
	}
	db.run('UPDATE col SET models = ?', [JSON.stringify(models)]);
	files['collection.anki2'] = db.export();
	db.close();
	return zipSync(files);
}

const out = process.argv[2];
if (!out) {
	console.error('usage: npx tsx scripts/make-test-apkg.ts <out-dir>');
	process.exit(2);
}
mkdirSync(out, { recursive: true });

const sqlDist = dirname(createRequire(import.meta.url).resolve('sql.js'));
const SQL = await initSqlJs({ locateFile: (file: string) => join(sqlDist, file) });

const builds = { v1, v2, v2Renamed, collideA, collideB };
const packages: Record<string, string> = {};
for (const [name, b] of Object.entries(builds)) {
	const path = join(out, `${name}.apkg`);
	writeFileSync(path, writeApkg(b, SQL));
	packages[name] = path;
}
packages.templateBump = join(out, 'templateBump.apkg');
writeFileSync(
	packages.templateBump,
	withBumpedTemplate(writeApkg({ ...v2, exportedAt: T2 + 60 }, SQL), SQL)
);

const guid = (verse: number) => `bm1:${DECK_ID}:bsb:JHN.3.${verse}:0`;
const manifest = {
	packages,
	builds,
	deckId: DECK_ID,
	changedGuid: guid(16),
	changedAnswer: spec(16, 0, 2, CHANGED_ANSWER).fields.Answer,
	removedGuid: guid(19),
	addedGuid: guid(21),
	v1Order: v1.notes.map((n) => n.guid),
	v2Order: v2.notes.map((n) => n.guid),
	modelId: MODEL_ID,
	packageDeckId: ankiDeckId(DECK_ID),
	templateMarker: TEMPLATE_MARKER,
	revisionTag: { v1: tag(DECK_ID, 1), v2: tag(DECK_ID, 2) }
};
writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, '\t'));
console.log(`wrote ${Object.keys(packages).length} packages to ${out}`);
