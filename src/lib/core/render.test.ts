import { describe, expect, it } from 'vitest';
import type { Line } from './model.ts';
import { escapeHtml, firstLetters, hintLines, hintText, renderLines } from './render.ts';

const line = (text: string, extra: Partial<Line> = {}): Line => ({ text, indent: 0, ...extra });

describe('renderLines', () => {
	it('renders one div per line', () => {
		expect(renderLines([line('The LORD is my shepherd;'), line('I shall not want.')])).toBe(
			'<div class="line">The LORD is my shepherd;</div><div class="line">I shall not want.</div>'
		);
	});

	it('puts the verse number marker at the start of the first line', () => {
		expect(renderLines([line('For God so loved'), line('the world')], 16)).toBe(
			'<div class="line"><span class="vn">16</span>For God so loved</div><div class="line">the world</div>'
		);
	});

	it('adds indent classes for levels 1 to 3 only', () => {
		const lines = ([0, 1, 2, 3] as const).map((indent) => line('x', { indent }));
		expect(renderLines(lines)).toBe(
			'<div class="line">x</div><div class="line i1">x</div><div class="line i2">x</div><div class="line i3">x</div>'
		);
	});

	it('marks paragraph starts, except on the first line of the output', () => {
		const lines = [line('a', { paragraph: true }), line('b', { indent: 1, paragraph: true })];
		expect(renderLines(lines)).toBe('<div class="line">a</div><div class="line i1 para">b</div>');
	});

	it('renders Selah like any other line', () => {
		expect(renderLines([line('Selah', { selah: true })])).toBe('<div class="line">Selah</div>');
	});

	it('escapes <, > and & in text', () => {
		expect(renderLines([line('a < b && c > d')])).toBe(
			'<div class="line">a &lt; b &amp;&amp; c &gt; d</div>'
		);
		expect(escapeHtml('"&<>')).toBe('&quot;&amp;&lt;&gt;');
	});

	it('renders nothing for no lines', () => {
		expect(renderLines([])).toBe('');
	});
});

describe('firstLetters', () => {
	const hint = (text: string) => firstLetters([line(text)]).replace(/<[^>]+>/g, '');

	it('reduces each word to its first letter, keeping punctuation around it', () => {
		expect(hint('“Trust in the LORD,')).toBe('“T i t L,');
		expect(hint('with all your heart;')).toBe('w a y h;');
		expect(hint('(and lean not!)”')).toBe('(a l n!)”');
	});

	it('keeps apostrophes inside a word out of the hint', () => {
		expect(hint('God’s glory, the LORD’s')).toBe('G g, t L');
	});

	it('gives each part of a hyphenated or dash-joined word its own letter', () => {
		expect(hint('well-being')).toBe('w-b');
		expect(hint('truth—the gospel')).toBe('t—t g');
		expect(hint('salvation—you')).toBe('s—y');
		expect(hint('One—“Holy')).toBe('O—“H');
	});

	it('keeps numerals whole', () => {
		expect(hint('153 fish, 144,000 sealed')).toBe('153 f, 144,000 s');
	});

	it('leaves a word with no letters as it is', () => {
		expect(hint('a — b')).toBe('a — b');
	});

	it('keeps the line structure and leaves out Selah lines', () => {
		const lines = [
			line('The LORD of Hosts is with us;'),
			line('the God of Jacob is our fortress.', { indent: 1, paragraph: true }),
			line('Selah', { selah: true })
		];
		expect(firstLetters(lines)).toBe(
			'<div class="line">T L o H i w u;</div><div class="line i1 para">t G o J i o f.</div>'
		);
	});

	it('escapes HTML in the hint', () => {
		expect(firstLetters([line('<b> & so')])).toBe('<div class="line">&lt;b&gt; &amp; s</div>');
	});
});

describe('hintText', () => {
	it('gives the first letters of one line as plain text, not HTML', () => {
		expect(hintText('“Trust in the LORD & lean,')).toBe('“T i t L & l,');
		expect(hintText('  well-being   <b> ')).toBe('w-b <b>');
	});
});

describe('hintLines', () => {
	it('gives the hint text line by line, keeping indents and leaving out Selah', () => {
		const lines = [
			{ text: '“Trust in the LORD & lean,', indent: 1 as const, paragraph: true as const },
			{ text: 'Selah', indent: 0 as const, selah: true as const },
			{ text: 'well-being <b>', indent: 2 as const }
		];
		expect(hintLines(lines)).toEqual([
			{ text: '“T i t L & l,', indent: 1, paragraph: true },
			{ text: 'w-b <b>', indent: 2 }
		]);
		expect(renderLines(hintLines(lines))).toBe(firstLetters(lines));
	});
});
