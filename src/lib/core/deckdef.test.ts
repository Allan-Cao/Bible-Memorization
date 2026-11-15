import { describe, expect, it } from 'vitest';
import {
	cleanDeckName,
	decodeShare,
	encodeShare,
	newDeck,
	parseDeckDefinition
} from './deckdef.ts';
import type { DeckDefinition } from './model.ts';

const valid: DeckDefinition = {
	v: 1,
	id: 'k3x9abcd',
	name: 'Gospel verses',
	translation: 'bsb',
	list: '# Gospel\nJohn 3:16\nPsalm 23',
	breaks: { 'JHN.3.16': [{ after: 7, word: 'Son,' }], '1JN.4.8': [] },
	revision: 3
};

describe('newDeck', () => {
	it('starts empty with a random 8-character id', () => {
		const deck = newDeck('My deck', 'kjv');
		expect(deck).toMatchObject({
			v: 1,
			name: 'My deck',
			translation: 'kjv',
			list: '',
			breaks: {},
			revision: 0
		});
		expect(deck.id).toMatch(/^[a-z0-9]{8}$/);
		expect(newDeck('x', 'bsb').id).not.toBe(deck.id);
	});
});

describe('cleanDeckName', () => {
	it('trims and collapses whitespace', () => {
		expect(cleanDeckName('  My \t deck\n name ')).toBe('My deck name');
	});

	it('never leaves a subdeck separator', () => {
		for (const name of ['A::B', 'A:::B', ':: A ::', 'A :: B']) {
			expect(cleanDeckName(name)).not.toContain('::');
		}
		expect(cleanDeckName('A::B')).toBe('A:B');
	});

	it('falls back when empty', () => {
		expect(cleanDeckName('   ')).toBe('Bible Memorization');
		expect(cleanDeckName('')).toBe('Bible Memorization');
	});
});

describe('parseDeckDefinition', () => {
	it('accepts a valid definition and drops unknown properties', () => {
		expect(parseDeckDefinition({ ...valid, extra: 1 })).toEqual(valid);
	});

	it('cleans the name', () => {
		expect(parseDeckDefinition({ ...valid, name: ' A::B ' }).name).toBe('A:B');
	});

	it.each([
		['not an object', null, /object/],
		['an array', [], /object/],
		['wrong version', { ...valid, v: 2 }, /version/],
		['short id', { ...valid, id: 'abc' }, /id/],
		['upper-case id', { ...valid, id: 'ABCDEFGH' }, /id/],
		['long id', { ...valid, id: 'a'.repeat(33) }, /id/],
		['unknown translation', { ...valid, translation: 'niv' }, /translation/],
		['non-string name', { ...valid, name: 5 }, /name/],
		['non-string list', { ...valid, list: ['John 3:16'] }, /list/],
		['breaks not an object', { ...valid, breaks: [] }, /breaks/],
		['bad break key', { ...valid, breaks: { 'john 3:16': [] } }, /breaks.*john 3:16/],
		['break value not an array', { ...valid, breaks: { 'JHN.3.16': {} } }, /breaks/],
		['negative after', { ...valid, breaks: { 'JHN.3.16': [{ after: -1, word: 'a' }] } }, /after/],
		[
			'fractional after',
			{ ...valid, breaks: { 'JHN.3.16': [{ after: 1.5, word: 'a' }] } },
			/after/
		],
		['non-string word', { ...valid, breaks: { 'JHN.3.16': [{ after: 1, word: 2 }] } }, /word/],
		['negative revision', { ...valid, revision: -1 }, /revision/],
		['fractional revision', { ...valid, revision: 1.5 }, /revision/],
		['missing revision', { ...valid, revision: undefined }, /revision/]
	])('rejects %s', (_, value, message) => {
		expect(() => parseDeckDefinition(value)).toThrow(message);
	});

	it('drops unknown properties inside breaks', () => {
		const parsed = parseDeckDefinition({
			...valid,
			breaks: { 'JHN.3.16': [{ after: 7, word: 'Son,', junk: true }] }
		});
		expect(parsed.breaks['JHN.3.16']).toEqual([{ after: 7, word: 'Son,' }]);
	});
});

describe('share links', () => {
	it('round-trips, including non-ASCII text and the revision', async () => {
		const def = { ...valid, name: 'Ψαλμοί – 詩篇 ✝', list: '# Café\nJohn 3:16\n', revision: 12 };
		const text = await encodeShare(def);
		expect(text).toMatch(/^[A-Za-z0-9_-]+$/);
		expect(await decodeShare(text)).toEqual(def);
	});

	it('keeps a typical 30-line list well under 2,000 characters', async () => {
		const list = Array.from({ length: 30 }, (_, i) => `Romans ${i + 1}:${i + 1}-${i + 3}`).join(
			'\n'
		);
		const text = await encodeShare({ ...valid, list });
		expect(text.length).toBeLessThan(1000);
	});

	it('throws a clear error on corrupt input', async () => {
		await expect(decodeShare('!!!not base64!!!')).rejects.toThrow(/link/);
		await expect(decodeShare('AAAA')).rejects.toThrow(/link/);
		await expect(decodeShare('')).rejects.toThrow(/link/);
	});

	it('rejects a link whose content is not a deck', async () => {
		const text = await encodeShare({ ...valid, v: 2 } as unknown as DeckDefinition);
		await expect(decodeShare(text)).rejects.toThrow(/version/);
	});
});
