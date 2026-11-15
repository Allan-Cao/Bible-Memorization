/**
 * Field HTML for cards. Class names are styled by the note type's CSS:
 *   .line  one printed line (block)     .i1 .i2 .i3  indent levels (level 0 has no class)
 *   .para  starts a paragraph or stanza  .vn  verse-number marker   .context  lead-in wrapper
 */

import type { Line } from './model.ts';

export function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

/** One `.line` div per line. `para` is never put on the first line: nothing is above it. */
export function renderLines(lines: Line[], verseNumber?: number): string {
	return lines
		.map((line, i) => {
			const classes = ['line'];
			if (line.indent) classes.push(`i${line.indent}`);
			if (line.paragraph && i > 0) classes.push('para');
			const marker =
				i === 0 && verseNumber !== undefined ? `<span class="vn">${verseNumber}</span>` : '';
			return `<div class="${classes.join(' ')}">${marker}${escapeHtml(line.text)}</div>`;
		})
		.join('');
}

/** The first-letter hint, with the same line structure. Selah lines are left out. */
export function firstLetters(lines: Line[]): string {
	return renderLines(
		lines
			.filter((line) => !line.selah)
			.map((line) => ({
				...line,
				text: line.text.split(/\s+/).filter(Boolean).map(hintWord).join(' ')
			}))
	);
}

/**
 * `“Trust` -> `“T`, `heart,` -> `h,`. Leading and trailing punctuation is kept.
 * Hyphen- or dash-joined words give a letter per part (`well-being` -> `w-b`).
 * Numerals are kept whole: a lone first digit says little about `144,000`.
 * A word with no letters or digits (a standalone dash) is kept as it is.
 */
function hintWord(word: string): string {
	const [, lead, core, trail] = /^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/su.exec(word)!;
	if (core === '' || /^\p{N}/u.test(core)) return word;
	const parts = core.split(/([-–—])/); // the dashes are kept as their own parts
	const letters = parts.length > 1 ? parts.map(hintWord).join('') : [...core][0];
	return lead + letters + trail;
}
