/**
 * Creating, cleaning, validating and sharing deck definitions.
 *
 * A definition arrives from untrusted places (a file or a link), so `parseDeckDefinition` checks
 * every field. A share link is the definition as JSON, deflated, as unpadded base64url.
 */

import type { Break, DeckDefinition, TranslationId } from './model.ts';
import { TRANSLATIONS } from './translations.ts';

const DEFAULT_NAME = 'Bible Memorization';
/** A share link never unpacks to more than this many bytes of JSON, however small the link. */
export const MAX_SHARE_BYTES = 1_000_000;
const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

export function newDeck(name: string, translation: TranslationId): DeckDefinition {
	const bytes = globalThis.crypto.getRandomValues(new Uint8Array(8));
	// 256 is not a multiple of 36, so the first letters are slightly likelier; ids need no more.
	const id = Array.from(bytes, (b) => ID_ALPHABET[b % ID_ALPHABET.length]).join('');
	return { v: 1, id, name, translation, list: '', breaks: {}, revision: 0 };
}

/** Anki reads `::` in a deck name as a subdeck separator, so it becomes a single colon. */
export function cleanDeckName(name: string): string {
	const clean = name.replace(/\s+/g, ' ').replace(/:{2,}/g, ':').trim();
	return clean || DEFAULT_NAME;
}

export function parseDeckDefinition(value: unknown): DeckDefinition {
	const o = asObject(value, 'deck');
	if (o.v !== 1) throw new Error(`Unsupported deck version: ${JSON.stringify(o.v)}`);
	if (typeof o.id !== 'string' || !/^[a-z0-9]{4,32}$/.test(o.id)) {
		throw new Error('Invalid deck id: expected 4 to 32 lower-case letters or digits');
	}
	if (typeof o.translation !== 'string' || !Object.hasOwn(TRANSLATIONS, o.translation)) {
		throw new Error(`Unknown translation: ${JSON.stringify(o.translation)}`);
	}
	if (typeof o.name !== 'string') throw new Error('Deck name must be text');
	if (typeof o.list !== 'string') throw new Error('Deck list must be text');
	if (!isCount(o.revision)) throw new Error('Deck revision must be a whole number, 0 or more');

	const breaks: Record<string, Break[]> = {};
	for (const [key, list] of Object.entries(asObject(o.breaks, 'breaks'))) {
		if (!/^[A-Z0-9]{3}\.\d+\.\d+$/.test(key)) throw new Error(`Invalid breaks key: "${key}"`);
		if (!Array.isArray(list)) throw new Error(`Invalid breaks for ${key}: expected a list`);
		breaks[key] = list.map((item) => {
			const b = asObject(item, `break in ${key}`);
			if (!isCount(b.after)) throw new Error(`Break "after" in ${key} must be a whole number`);
			if (typeof b.word !== 'string') throw new Error(`Break "word" in ${key} must be text`);
			return { after: b.after, word: b.word };
		});
	}

	return {
		v: 1,
		id: o.id,
		name: cleanDeckName(o.name),
		translation: o.translation as TranslationId,
		list: o.list,
		breaks,
		revision: o.revision
	};
}

export async function encodeShare(def: DeckDefinition): Promise<string> {
	const packed = await pipe(
		new TextEncoder().encode(JSON.stringify(def)),
		new CompressionStream('deflate-raw')
	);
	let binary = '';
	for (const byte of packed) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function decodeShare(text: string): Promise<DeckDefinition> {
	let bytes: Uint8Array | null;
	let json: unknown;
	try {
		const binary = atob(text.trim().replace(/-/g, '+').replace(/_/g, '/'));
		const packed = Uint8Array.from(binary, (c) => c.charCodeAt(0));
		bytes = await inflateAtMost(packed, MAX_SHARE_BYTES);
		if (bytes) json = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
	} catch {
		throw new Error('This link is damaged or incomplete, so the deck could not be read');
	}
	if (!bytes) throw new Error('This link holds a deck that is too large to open');
	return parseDeckDefinition(json);
}

/** Inflates chunk by chunk and stops as soon as the output passes `max` bytes (returns null). */
async function inflateAtMost(packed: Uint8Array<ArrayBuffer>, max: number) {
	const reader = new Blob([packed])
		.stream()
		.pipeThrough(new DecompressionStream('deflate-raw'))
		.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		size += value.length;
		if (size > max) {
			await reader.cancel();
			return null;
		}
		chunks.push(value);
	}
	const out = new Uint8Array(size);
	let at = 0;
	for (const chunk of chunks) {
		out.set(chunk, at);
		at += chunk.length;
	}
	return out;
}

async function pipe(
	bytes: Uint8Array<ArrayBuffer>,
	stream: CompressionStream | DecompressionStream
) {
	const out = new Response(new Blob([bytes]).stream().pipeThrough(stream));
	return new Uint8Array(await out.arrayBuffer());
}

function asObject(value: unknown, what: string): Record<string, unknown> {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		throw new Error(`Expected ${what} to be an object`);
	}
	return value as Record<string, unknown>;
}

function isCount(value: unknown): value is number {
	return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}
