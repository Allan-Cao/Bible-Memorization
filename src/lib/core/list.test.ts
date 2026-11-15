import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOOKS } from './books.ts';
import { parseList } from './list.ts';
import type { Versification } from './model.ts';

const vers: Versification = {
	JHN: [51, 25, 36, 54, 47, 71, 53, 59, 41, 42, 57, 50, 38, 31, 27, 33, 26, 40, 42, 31, 25],
	PSA: Array<number>(150).fill(10),
	JUD: [25]
};

const labels = (text: string) =>
	parseList(text, vers).groups.map((g) => [g.heading, g.refs.map((r) => r.label)]);

describe('parseList: groups', () => {
	it.each([
		['one reference, no heading', 'John 3:16', [[null, ['John 3:16']]]],
		[
			'blank lines are ignored',
			'\n\nJohn 3:16\n\n\nPsalm 23\n',
			[[null, ['John 3:16', 'Psalm 23']]]
		],
		['surrounding spaces are ignored', '   John 3:16   \r\n', [[null, ['John 3:16']]]],
		['a heading starts a group', '# Gospel\nJohn 3:16', [['Gospel', ['John 3:16']]]],
		['## is the same as #', '## Gospel\nJohn 3:16', [['Gospel', ['John 3:16']]]],
		['heading text is trimmed', '#   Gospel  \nJohn 3:16', [['Gospel', ['John 3:16']]]],
		['no space after #', '#Gospel\nJohn 3:16', [['Gospel', ['John 3:16']]]],
		[
			'references before a heading get a null heading',
			'Psalm 23\n# Gospel\nJohn 3:16',
			[
				[null, ['Psalm 23']],
				['Gospel', ['John 3:16']]
			]
		],
		[
			'an empty group is dropped',
			'# Title\n# Gospel\nJohn 3:16\n# Empty',
			[['Gospel', ['John 3:16']]]
		],
		[
			'two groups keep their order',
			'# A\nPsalm 23\n# B\nJohn 3:16',
			[
				['A', ['Psalm 23']],
				['B', ['John 3:16']]
			]
		],
		['labels are normalized', 'ps 23\njn 3.16-18', [[null, ['Psalm 23', 'John 3:16-18']]]],
		['empty text', '', []],
		['only headings', '# A\n# B', []]
	])('%s', (_name, text, expected) => {
		expect(labels(text)).toEqual(expected);
		expect(parseList(text, vers).errors).toEqual([]);
	});

	it('keeps the parsed ranges on each reference', () => {
		const { groups } = parseList('Psalm 23', vers);
		expect(groups[0].refs[0].ranges).toEqual([
			{
				start: { book: 'PSA', chapter: 23, verse: 1 },
				end: { book: 'PSA', chapter: 23, verse: 10 }
			}
		]);
	});
});

describe('parseList: errors', () => {
	it.each([
		['unknown book', 'Hezekiah 1:1', 1, 'Unknown book'],
		['chapter out of range', 'John 30:1', 1, 'John has 21 chapters'],
		['reversed range', 'John 3:18-16', 1, 'reversed'],
		['trailing junk', 'John 3:16a', 1, 'Unexpected'],
		['line numbers count blank lines', '\n\n# H\n\nJohn 3:99', 5, 'John 3 has 36 verses']
	])('%s', (_name, text, line, fragment) => {
		const { errors } = parseList(text, vers);
		expect(errors).toHaveLength(1);
		expect(errors[0].line).toBe(line);
		expect(errors[0].message).toContain(fragment);
	});

	it('keeps the raw input, untrimmed of its typing but without surrounding space', () => {
		const { errors } = parseList('  Hezekiah 1:1  ', vers);
		expect(errors[0].input).toBe('Hezekiah 1:1');
	});

	it('keeps parsing after an error', () => {
		const result = parseList('John 3:16\nbogus\nPsalm 23\nJohn 99:1', vers);
		expect(result.groups[0].refs.map((r) => r.label)).toEqual(['John 3:16', 'Psalm 23']);
		expect(result.errors.map((e) => e.line)).toEqual([2, 4]);
	});

	it('does not let an invalid line create a group', () => {
		const result = parseList('# Only bad\nbogus', vers);
		expect(result.groups).toEqual([]);
		expect(result.errors).toHaveLength(1);
	});
});

describe('parseList: duplicates', () => {
	it('flags the second occurrence', () => {
		const { groups, errors } = parseList('John 3:16\nPsalm 23\nJohn 3:16', vers);
		expect(groups[0].refs).toHaveLength(2);
		expect(errors).toEqual([
			{ line: 3, input: 'John 3:16', message: expect.stringContaining('line 1') }
		]);
	});

	it('compares normalized references, not typed text', () => {
		const { errors } = parseList('Psalm 23\nps 23\nPsalms 23', vers);
		expect(errors.map((e) => e.line)).toEqual([2, 3]);
	});

	it('flags duplicates across groups', () => {
		const { groups, errors } = parseList('# A\nJohn 3:16\n# B\nJohn 3:16', vers);
		expect(errors.map((e) => e.line)).toEqual([4]);
		expect(groups.map((g) => g.heading)).toEqual(['A']);
	});

	it('does not treat different passages as duplicates', () => {
		expect(parseList('John 3:16\nJohn 3:16-17\nJohn 3:17', vers).errors).toEqual([]);
	});
});

describe('preset lists', () => {
	// Permissive fake: every book gets 150 chapters of 200 verses, so only the syntax is checked.
	// Switch this to the real versification once it is in the repo.
	const permissive: Versification = Object.fromEntries(
		BOOKS.map((b) => [b.id, Array<number>(150).fill(200)])
	);

	it.each(['ot.txt', 'nt.txt'])('every reference in %s parses', (file) => {
		const text = readFileSync(new URL(`../../../presets/${file}`, import.meta.url), 'utf8');
		const { groups, errors } = parseList(text, permissive);
		expect(errors).toEqual([]);
		expect(groups.flatMap((g) => g.refs).length).toBeGreaterThan(10);
	});
});
