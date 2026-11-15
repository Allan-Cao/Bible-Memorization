import { describe, expect, it } from 'vitest';
import { cleanupSearch, diffExport, revisionTag } from './diff.ts';
import type { DeckDefinition } from './model.ts';

const def: DeckDefinition = {
	v: 1,
	id: 'k3x9',
	name: 'Test',
	translation: 'bsb',
	list: '',
	breaks: {},
	revision: 4
};

describe('diffExport', () => {
	it('treats everything as added on the first export', () => {
		expect(diffExport(null, { labels: ['John 3:16', 'Psalm 23'], guids: ['a', 'b', 'c'] })).toEqual(
			{
				addedPassages: ['John 3:16', 'Psalm 23'],
				removedPassages: [],
				addedNotes: 3,
				removedNotes: 0,
				firstExport: true
			}
		);
	});

	it('reports nothing for an identical export', () => {
		const snap = { labels: ['John 3:16'], guids: ['a'] };
		expect(diffExport(snap, snap)).toEqual({
			addedPassages: [],
			removedPassages: [],
			addedNotes: 0,
			removedNotes: 0,
			firstExport: false
		});
	});

	it('lists added and removed passages in input order and counts notes', () => {
		const previous = { labels: ['A', 'B', 'C'], guids: ['1', '2', '3', '4'] };
		const next = { labels: ['Z', 'B', 'Y', 'A'], guids: ['2', '1', '9'] };
		expect(diffExport(previous, next)).toEqual({
			addedPassages: ['Z', 'Y'],
			removedPassages: ['C'],
			addedNotes: 1,
			removedNotes: 2,
			firstExport: false
		});
	});
});

describe('revisionTag and cleanupSearch', () => {
	it('tags notes with deck id and revision', () => {
		expect(revisionTag(def)).toBe('bm::k3x9::r4');
	});

	it('searches for notes of the deck that are not in the current revision', () => {
		expect(cleanupSearch(def)).toBe('tag:bm::k3x9::* -tag:bm::k3x9::r4');
	});
});
