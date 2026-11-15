import { describe, expect, it } from 'vitest';
import { BOOKS } from './books.ts';
import { versificationFor } from './versification.ts';

describe('versificationFor', () => {
	it.each(['bsb', 'web', 'kjv'] as const)('covers all 66 books for %s', (t) => {
		const v = versificationFor(t);
		expect(Object.keys(v)).toEqual(BOOKS.map((b) => b.id));
	});

	it.each(['bsb', 'web', 'kjv'] as const)('has the expected chapter counts for %s', (t) => {
		const v = versificationFor(t);
		expect(v.PSA).toHaveLength(150);
		expect(v.JHN).toHaveLength(21);
		expect(v.JUD).toHaveLength(1);
		expect(v.PSA[22]).toBe(6);
		expect(v.PSA[118]).toBe(176);
		expect(v.JHN[2]).toBe(36);
	});

	it('reports the highest verse even when a verse is omitted (BSB Matthew 17:21)', () => {
		expect(versificationFor('bsb').MAT[16]).toBe(27);
	});
});
