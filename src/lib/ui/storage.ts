/**
 * Decks and export snapshots in localStorage. Every access is guarded: when storage is blocked
 * or full, an in-memory copy keeps the app working for the visit.
 */
import { parseDeckDefinition } from '#lib/core/deckdef.ts';
import type { DeckDefinition, TranslationId } from '#lib/core/model.ts';

/** What the last export contained, to describe the next one. `at` is in milliseconds. */
export interface ExportSnapshot {
	labels: string[];
	guids: string[];
	name: string;
	translation: TranslationId;
	at: number;
}

const DECK = 'bm.deck.';
const EXPORT = 'bm.export.';
/** Values whose last write did not reach localStorage: newer than what is stored there. */
const memory = new Map<string, string>();

function read(key: string): unknown {
	let text = memory.get(key) ?? null;
	try {
		text ??= localStorage.getItem(key);
	} catch {
		// memory only
	}
	try {
		return text === null ? null : JSON.parse(text);
	} catch {
		return null;
	}
}

function write(key: string, value: unknown): void {
	const text = JSON.stringify(value);
	try {
		localStorage.setItem(key, text);
		memory.delete(key);
	} catch {
		memory.set(key, text); // kept for this visit only
	}
}

function remove(key: string): void {
	memory.delete(key);
	try {
		localStorage.removeItem(key);
	} catch {
		// nothing stored
	}
}

function keys(): string[] {
	const all = new Set(memory.keys());
	try {
		for (let i = 0; i < localStorage.length; i++) all.add(localStorage.key(i)!);
	} catch {
		// memory only
	}
	return [...all];
}

export function loadDeck(id: string): DeckDefinition | null {
	try {
		return parseDeckDefinition(read(DECK + id));
	} catch {
		return null;
	}
}

export function listDecks(): DeckDefinition[] {
	return keys()
		.filter((key) => key.startsWith(DECK))
		.map((key) => loadDeck(key.slice(DECK.length)))
		.filter((def) => def !== null)
		.sort((a, b) => a.name.localeCompare(b.name));
}

let persistAsked = false;

export function saveDeck(def: DeckDefinition): void {
	write(DECK + def.id, def);
	if (persistAsked || !deckStored(def.id)) return;
	persistAsked = true;
	// Safari can clear storage written by a page after seven days without a visit, unless the
	// browser agrees to keep it.
	navigator.storage
		?.persisted?.()
		.then((done) => done || navigator.storage.persist())
		.catch(() => {});
}

/** Whether the deck's last save reached localStorage, rather than living only in this page. */
export function deckStored(id: string): boolean {
	return !memory.has(DECK + id);
}

export function deleteDeck(id: string): void {
	remove(DECK + id);
	remove(EXPORT + id);
}

/**
 * Calls `onchange` when another tab changes this deck or its export record, after which
 * `loadDeck` and `loadExport` return the other tab's version. Returns a function to stop.
 */
export function watchDeck(id: string, onchange: () => void): () => void {
	const listener = (e: StorageEvent) => {
		// A null key means another tab cleared all of storage.
		if (e.key !== null && e.key !== DECK + id && e.key !== EXPORT + id) return;
		if (e.key !== null) memory.delete(e.key); // the other tab's version is newer
		onchange();
	};
	addEventListener('storage', listener);
	return () => removeEventListener('storage', listener);
}

export function loadExport(id: string): ExportSnapshot | null {
	const s = read(EXPORT + id) as ExportSnapshot | null;
	const ok =
		s &&
		Array.isArray(s.labels) &&
		Array.isArray(s.guids) &&
		typeof s.name === 'string' &&
		typeof s.translation === 'string' &&
		typeof s.at === 'number';
	return ok ? s : null;
}

export function saveExport(id: string, snapshot: ExportSnapshot): void {
	write(EXPORT + id, snapshot);
}
