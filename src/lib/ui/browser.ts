/** The browser side of the core: fetching the Bible text, writing the .apkg, saving files. */
import { asset } from '$app/paths';
import type { AssetPath } from '$app/types';
import { writeApkg } from '#lib/core/anki/apkg.ts';
import { buildDeck, type LoadBooks } from '#lib/core/build.ts';
import { cleanDeckName } from '#lib/core/deckdef.ts';
import { cleanupSearch, diffExport } from '#lib/core/diff.ts';
import { insertedPassages } from '#lib/core/editor.ts';
import type { BookText, DeckDefinition } from '#lib/core/model.ts';
import type { SqlJsStatic } from 'sql.js';
import { loadExport, saveExport } from './storage.ts';

const books = new Map<string, Promise<BookText>>();

/** `path` is built from a translation and book id, so the type checker cannot list it. */
function loadBook(path: string): Promise<BookText> {
	let book = books.get(path);
	if (!book) {
		book = fetch(asset(path as AssetPath)).then((response) => {
			if (!response.ok) throw new Error(`Could not load the Bible text (${response.status})`);
			return response.json() as Promise<BookText>;
		});
		book.catch(() => books.delete(path)); // try again next time
		books.set(path, book);
	}
	return book;
}

export const loadBooks: LoadBooks = async (translation, ids) =>
	Object.fromEntries(
		await Promise.all(ids.map(async (id) => [id, await loadBook(`text/${translation}/${id}.json`)]))
	);

let sql: Promise<SqlJsStatic> | undefined;

/** sql.js and its WASM file are fetched on the first export only. */
function loadSql(): Promise<SqlJsStatic> {
	sql ??= Promise.all([import('sql.js'), import('sql.js/dist/sql-wasm-browser.wasm?url')]).then(
		([{ default: init }, { default: wasm }]) => init({ locateFile: () => wasm })
	);
	sql.catch(() => (sql = undefined));
	return sql;
}

/** A file name from the deck name, without characters file systems refuse. */
export function fileName(name: string, extension: string): string {
	return `${cleanDeckName(name).replace(/[\\/:*?"<>|]+/g, '-')}.${extension}`;
}

export function downloadFile(name: string, data: BlobPart, type: string): void {
	const url = URL.createObjectURL(new Blob([data], { type }));
	const a = Object.assign(document.createElement('a'), { href: url, download: name });
	document.body.append(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export interface ExportReport {
	fileName: string;
	changes: ReturnType<typeof diffExport>;
	search: string;
	/** Passages added in front of cards already in Anki. */
	inserted: string[];
	/** The name the deck had at the previous export, when it differs. */
	renamedFrom: string | null;
}

/** Builds and downloads the package for `def` (revision already bumped) and records the export. */
export async function exportDeck(def: DeckDefinition): Promise<ExportReport> {
	const exportedAt = Math.floor(Date.now() / 1000);
	const [result, SQL] = await Promise.all([buildDeck(def, loadBooks, exportedAt), loadSql()]);
	if (result.errors.length)
		throw new Error('Some lines of the list have mistakes. Fix them first.');
	if (result.build.notes.length === 0) throw new Error('The list has no passages yet.');
	const bytes = writeApkg(result.build, SQL);
	const name = fileName(def.name, 'apkg');
	downloadFile(name, bytes as Uint8Array<ArrayBuffer>, 'application/octet-stream');

	const previous = loadExport(def.id);
	const next = {
		labels: result.passages.map((p) => p.ref.label),
		guids: result.build.notes.map((n) => n.guid)
	};
	const deckName = result.build.deckName;
	saveExport(def.id, { ...next, name: deckName, translation: def.translation, at: Date.now() });
	return {
		fileName: name,
		changes: diffExport(previous, next),
		search: cleanupSearch(def),
		inserted: insertedPassages(previous?.labels ?? null, next.labels),
		renamedFrom: previous && previous.name !== deckName ? previous.name : null
	};
}
