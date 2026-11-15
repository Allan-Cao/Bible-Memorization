/**
 * Decks and export snapshots in localStorage. Every access is guarded: when storage is blocked,
 * an in-memory copy keeps the app working for the visit.
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
const memory = new Map<string, string>();

function read(key: string): unknown {
	let text: string | null | undefined;
	try {
		text = localStorage.getItem(key);
	} catch {
		// fall back to memory
	}
	text ??= memory.get(key) ?? null;
	try {
		return text === null ? null : JSON.parse(text);
	} catch {
		return null;
	}
}

function write(key: string, value: unknown): void {
	const text = JSON.stringify(value);
	memory.set(key, text);
	try {
		localStorage.setItem(key, text);
	} catch {
		// kept in memory only
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

export function saveDeck(def: DeckDefinition): void {
	write(DECK + def.id, def);
}

export function deleteDeck(id: string): void {
	remove(DECK + id);
	remove(EXPORT + id);
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
