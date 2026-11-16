/**
 * How the automatic split rule (src/lib/core/units.ts) behaves on the whole committed text.
 * Prints, per translation: verses over MAX_WORDS, why some stay unsplit, the part sizes, and the
 * worst cases by largest part. Run:  npx tsx scripts/split-report.ts [worst=15]
 */
import { readFileSync } from 'node:fs';
import { BOOKS } from '../src/lib/core/books.ts';
import { verseLabel } from '../src/lib/core/refs.ts';
import type { BookText, Line, TranslationId, Verse } from '../src/lib/core/model.ts';
import {
	MAX_WORDS,
	MIN_PART_WORDS,
	SOFT_MAX_PART_WORDS,
	splitUnits,
	verseWords
} from '../src/lib/core/units.ts';

const WORST = Number(process.argv[2] ?? 15);
const words = (lines: Line[]) =>
	lines.filter((l) => !l.selah).flatMap((l) => l.text.split(/\s+/).filter(Boolean));

/** Rough copy of units.ts `strength`: punctuation or a line end after the word. */
function hasUsableBreak(verse: Verse): boolean {
	const ends = verse.lines
		.filter((l) => !l.selah)
		.flatMap((l) => {
			const w = l.text.split(/\s+/).filter(Boolean);
			return w.map((text, i) => i === w.length - 1 || /[.?!;:—,]["'”’)\]»]*$/.test(text));
		});
	for (let i = MIN_PART_WORDS - 1; i < ends.length - MIN_PART_WORDS; i++) if (ends[i]) return true;
	return false;
}

function report(translation: TranslationId) {
	let total = 0;
	let long = 0;
	let over90 = 0;
	let longest = { ref: '', n: 0 };
	const unsplit = { noBreak: [] as string[], other: [] as string[] };
	const sizes = new Map<string, number>();
	const worst: { ref: string; n: number; sizes: number[]; at: string[] }[] = [];

	for (const book of BOOKS) {
		const url = new URL(`../static/text/${translation}/${book.id}.json`, import.meta.url);
		const text: BookText = JSON.parse(readFileSync(url, 'utf8'));
		text.chapters.forEach((chapter, c) => {
			for (const stored of chapter) {
				const verse: Verse = { ref: { book: book.id, chapter: c + 1, verse: stored.v }, ...stored };
				total++;
				const n = verseWords(verse).length;
				if (n <= MAX_WORDS) continue;
				long++;
				if (n > 90) over90++;
				if (n > longest.n) longest = { ref: verseLabel(verse.ref), n };
				const { units } = splitUnits(verse);
				const label = `${verseLabel(verse.ref)} (${n})`;
				if (units.length === 1) {
					(hasUsableBreak(verse) ? unsplit.other : unsplit.noBreak).push(label);
					continue;
				}
				const parts = units.map((u) => words(u.lines).length);
				for (const p of parts) {
					const bucket =
						p <= 15 ? '10-15' : p <= 25 ? '16-25' : p <= 35 ? '26-35' : p <= 45 ? '36-45' : '46+';
					sizes.set(bucket, (sizes.get(bucket) ?? 0) + 1);
				}
				const at = units.slice(0, -1).map((u) => words(u.lines).at(-1)!);
				worst.push({ ref: verseLabel(verse.ref), n, sizes: parts, at });
			}
		});
	}

	worst.sort((a, b) => Math.max(...b.sizes) - Math.max(...a.sizes) || b.n - a.n);
	const parts = [...sizes.values()].reduce((a, b) => a + b, 0);
	const overCap = worst.filter((w) => Math.max(...w.sizes) > SOFT_MAX_PART_WORDS).length;
	console.log(`\n=== ${translation.toUpperCase()} ===`);
	console.log(
		`verses ${total}, over ${MAX_WORDS} words ${long}, over 90 words ${over90}, longest ${longest.ref} (${longest.n})`
	);
	console.log(
		`split ${worst.length}; split with a part over ${SOFT_MAX_PART_WORDS} words ${overCap}`
	);
	console.log(
		`unsplit: no punctuation leaving ${MIN_PART_WORDS}+ words each side ${unsplit.noBreak.length}, other ${unsplit.other.length}`
	);
	if (unsplit.noBreak.length) console.log(`  no usable break: ${unsplit.noBreak.join(', ')}`);
	if (unsplit.other.length) console.log(`  other: ${unsplit.other.join(', ')}`);
	console.log('part sizes:');
	for (const b of ['10-15', '16-25', '26-35', '36-45', '46+']) {
		const k = sizes.get(b) ?? 0;
		console.log(`  ${b.padEnd(6)} ${String(k).padStart(5)}  ${((100 * k) / parts).toFixed(1)}%`);
	}
	console.log(`worst ${WORST} by largest part:`);
	for (const w of worst.slice(0, WORST)) {
		console.log(
			`  ${w.ref.padEnd(22)} ${String(w.n).padStart(3)}w  ${w.sizes.join(' / ').padEnd(14)} after: ${w.at.join(' | ')}`
		);
	}
}

for (const t of ['bsb', 'web', 'kjv'] as const) report(t);
