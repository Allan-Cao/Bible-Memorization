import { describe, expect, it } from 'vitest';
import type { RefRange, VerseRef } from './model.ts';

describe('model', () => {
	it('describes a single verse as a range with equal start and end', () => {
		const ref: VerseRef = { book: 'JHN', chapter: 3, verse: 16 };
		const range: RefRange = { start: ref, end: ref };
		expect(range.start).toEqual(range.end);
	});
});
