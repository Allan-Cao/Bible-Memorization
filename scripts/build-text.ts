/**
 * Converts eBible.org USFM into the app's committed Bible text:
 *   static/text/{bsb,web,kjv}/{BOOK}.json  one BookText per book, compact JSON
 *   src/lib/core/versification.json        highest verse number of each chapter
 *
 * Run:  npx tsx scripts/build-text.ts            (downloads the zips into .cache/usfm/ once)
 *       npx tsx scripts/build-text.ts --refresh  (downloads them again)
 *
 * Only a small subset of USFM is understood. Any other marker, a verse bridge, or text that
 * cannot be placed makes the build fail with the book, chapter and verse, so nothing leaks
 * into the text silently. The parsing functions are pure; only `main` does I/O.
 */
import { BOOKS } from '../src/lib/core/books.ts';
import type {
	BookText,
	Line,
	StoredVerse,
	TranslationId,
	Versification
} from '../src/lib/core/model.ts';

/** The 66 books of the Protestant canon as USFM codes, in canonical order. */
export const BOOK_CODES: readonly string[] = BOOKS.map((b) => b.id);

type Indent = Line['indent'];

interface Style {
	indent: Indent;
	paragraph?: boolean;
	/** \nb: the chapter continues the previous chapter's paragraph. */
	noBreak?: boolean;
	/** \qr: right-aligned line; a Selah line in BSB. */
	right?: boolean;
}

/** Markers whose whole source line is dropped: identification, titles, headings, references. */
const DROPPED_LINES = new Set([
	'id',
	'ide',
	'h',
	'toc1',
	'toc2',
	'toc3',
	'mt',
	'mt1',
	'mt2',
	'mt3',
	'ms',
	'ms1',
	'mr',
	's',
	's1',
	's2',
	's3',
	'r',
	'sp',
	'cl',
	'qa'
]);

/** Markers that start a new line of text. \b is handled apart: it only flags the next line. */
const PARAGRAPHS: Record<string, Style> = {
	p: { indent: 0, paragraph: true },
	pmo: { indent: 0, paragraph: true },
	pc: { indent: 0, paragraph: true },
	pi: { indent: 1, paragraph: true },
	pi1: { indent: 1, paragraph: true },
	m: { indent: 0 },
	mi: { indent: 1 },
	nb: { indent: 0, noBreak: true },
	li: { indent: 0 },
	li1: { indent: 0 },
	li2: { indent: 1 },
	q: { indent: 0 },
	q1: { indent: 0 },
	q2: { indent: 1 },
	q3: { indent: 2 },
	q4: { indent: 3 },
	qr: { indent: 1, right: true }
};

/** Character markers that are unwrapped, keeping their words. \qs (Selah) is handled apart. */
const CHARACTERS = new Set(['w', 'wj', 'add', 'nd', 'bk', 'it', 'tl', 'qt', 'bd', 'sc']);

/** Notes, removed with everything inside them. */
const NOTES = new Set(['f', 'x']);

/** Punctuation that must not follow a space left behind by a removed note. */
const CLOSING_PUNCTUATION = /^\s*[,.;:!?)\]’”]/;

export class UsfmError extends Error {}

/** Parses one USFM book. Throws UsfmError on anything it cannot represent faithfully. */
export function parseUsfm(source: string, translation: TranslationId): BookText {
	return new Parser(translation).run(source);
}

/**
 * Single spaces, no leading or trailing space. A non-breaking space between two quote marks
 * (WEB: ‘walk.’ ”) is removed so a lone quote mark never becomes a word of its own.
 */
function clean(text: string): string {
	return text
		.replace(/[ \t\r\n]+/g, ' ')
		.replace(/([‘’“”])\u00a0(?=[‘’“”])/g, '$1')
		.trim();
}

/** \nd is printed in capitals ("LORD"), but a possessive stays lowercase ("LORD’s"). */
function capitals(text: string): string {
	return text.toUpperCase().replace(/’S\b/g, '’s');
}

/**
 * Splits an untagged "Selah" off a line of text: always when it is the last word, and inside the
 * line only when punctuated ("Selah." or "Selah:"), so the place name ("took Selah by war") stays.
 */
export function splitSelah(text: string): { text: string; selah: boolean }[] {
	const parts: { text: string; selah: boolean }[] = [];
	const word = /(?<=^|\s)Selah([.:]?)(?=\s|$)/g;
	let start = 0;
	for (let m = word.exec(text); m; m = word.exec(text)) {
		const last = text.slice(m.index + m[0].length).trim() === '';
		if (!last && !m[1]) continue;
		const before = text.slice(start, m.index).trim();
		if (before) parts.push({ text: before, selah: false });
		parts.push({ text: 'Selah', selah: true });
		start = m.index + m[0].length;
	}
	const tail = text.slice(start).trim();
	if (tail) parts.push({ text: tail, selah: false });
	return parts;
}

class Parser {
	private book = '';
	private chapters: StoredVerse[][] = [];
	private verse: StoredVerse | null = null;
	/** Text of the open line, or null when no line is open. */
	private buf: string | null = null;
	private style: Style = { indent: 0 };
	/** Style set by a paragraph marker, applied to the next line that receives text. */
	private pending: Style | null = null;
	private blank = false;
	private chapterStart = false;
	private pilcrow = false;
	private lastIndent: Indent = 0;
	/** Open character markers, innermost last. */
	private chars: string[] = [];
	private note: string | null = null;
	private afterNote = false;
	/** Inside \w after the "|": attributes, dropped up to the next marker. */
	private attributes = false;
	private capture: 'title' | 'selah' | null = null;
	private captured = '';
	private title: string | null = null;
	private translation: TranslationId;

	constructor(translation: TranslationId) {
		this.translation = translation;
	}

	run(source: string): BookText {
		for (const raw of source.replace(/^\uFEFF/, '').split(/\r?\n/)) {
			const first = /^\\([a-z]+\d*)(?=\s|$)/.exec(raw);
			if (first && DROPPED_LINES.has(first[1]) && !this.note) {
				this.finishTitle();
				if (first[1] === 'id') this.book = raw.slice(4).trim().split(/\s/)[0];
				continue;
			}
			this.tokens(raw + '\n');
		}
		this.boundary();
		this.endVerse();
		if (this.note) this.fail(`unterminated \\${this.note} note`);
		if (this.title !== null) this.fail('psalm title with no verse after it');
		if (!this.book) this.fail('missing \\id');
		if (this.chapters.length === 0) this.fail('no chapters');
		return { book: this.book, translation: this.translation, chapters: this.chapters };
	}

	private where(): string {
		const c = this.chapters.length;
		return `${this.book || '?'} ${c}${this.verse ? `:${this.verse.v}` : ''}`;
	}

	private fail(message: string): never {
		throw new UsfmError(`${this.translation} ${this.where()}: ${message}`);
	}

	private tokens(s: string): void {
		const marker = /\\(\+?)([a-z]+\d*)(\*?)/y;
		let i = 0;
		while (i < s.length) {
			if (s[i] !== '\\') {
				const next = s.indexOf('\\', i);
				const end = next < 0 ? s.length : next;
				this.text(s.slice(i, end));
				i = end;
				continue;
			}
			marker.lastIndex = i;
			const m = marker.exec(s);
			if (!m) this.fail(`stray backslash: ${s.slice(i, i + 20)}`);
			i = marker.lastIndex;
			const [, plus, name, star] = m;
			this.attributes = false;
			if (star) {
				this.close(name, plus);
			} else if ((name === 'c' || name === 'v') && !this.note) {
				const num = /[ \t]*(\S*)[ \t]?/y;
				num.lastIndex = i;
				const arg = num.exec(s)![1];
				i = num.lastIndex;
				if (name === 'c') this.chapter(arg);
				else this.startVerse(arg);
			} else {
				if (s[i] === ' ') i++; // the space after a marker separates it from its text
				this.open(name, plus);
			}
		}
	}

	private open(name: string, plus: string): void {
		if (this.note) return; // everything inside a note is dropped
		if (NOTES.has(name)) {
			this.note = name;
			return;
		}
		if (name === 'qs') {
			this.closeLine();
			this.chars.push(name);
			this.capture = 'selah';
			this.captured = '';
			return;
		}
		if (CHARACTERS.has(name)) {
			this.chars.push(name);
			return;
		}
		if (plus) this.fail(`unknown USFM marker \\+${name}`);
		if (name === 'b') {
			this.boundary();
			this.blank = true;
			return;
		}
		if (name === 'd') {
			this.boundary();
			this.capture = 'title';
			this.captured = '';
			return;
		}
		const style = PARAGRAPHS[name];
		if (!style) {
			if (DROPPED_LINES.has(name)) this.fail(`\\${name} must start a line`);
			this.fail(`unknown USFM marker \\${name}`);
		}
		this.boundary();
		this.pending = { ...style, paragraph: style.paragraph || this.pending?.paragraph };
	}

	private close(name: string, plus: string): void {
		if (this.note) {
			if (name === this.note) {
				this.note = null;
				this.afterNote = true;
			}
			return;
		}
		if (this.chars[this.chars.length - 1] !== name) {
			this.fail(`\\${plus}${name}* without a matching opening marker`);
		}
		this.chars.pop();
		if (name === 'qs') this.emitSelah();
	}

	private text(s: string): void {
		if (this.note || this.attributes) return;
		if (this.chars.includes('w') && s.includes('|')) {
			s = s.slice(0, s.indexOf('|'));
			this.attributes = true;
		}
		if (this.chars.includes('nd')) s = capitals(s);
		if (this.capture) {
			this.captured += s;
			return;
		}
		if (s.includes('¶')) {
			if (this.buf?.trim()) this.fail('pilcrow inside a line');
			s = s.replaceAll('¶', '');
			this.pilcrow = true;
			if (this.buf !== null) this.style.paragraph = true;
		}
		if (!s.trim()) {
			if (this.buf !== null) this.buf += s;
			return;
		}
		if (!this.verse) this.fail(`text outside any verse: "${clean(s)}"`);
		if (this.buf === null) this.openLine();
		if (this.afterNote && CLOSING_PUNCTUATION.test(s)) {
			this.buf = this.buf!.trimEnd();
			s = s.trimStart();
		}
		this.afterNote = false;
		this.buf += s;
	}

	private openLine(): void {
		const style = this.pending ?? { indent: this.lastIndent };
		const paragraph =
			!!style.paragraph || this.blank || this.pilcrow || (this.chapterStart && !style.noBreak);
		this.style = { ...style, paragraph };
		this.pending = null;
		this.blank = this.pilcrow = this.chapterStart = false;
		this.buf = '';
	}

	private closeLine(): void {
		if (this.buf === null) return;
		const text = clean(this.buf);
		const style = this.style;
		this.buf = null;
		if (!text) return;
		const lines = this.verse!.lines;
		const para: Partial<Line> = style.paragraph ? { paragraph: true } : {};
		const right = style.right && /^(.*\bSelah)[\s.,:;—–-]*$/.exec(text);
		if (right) {
			lines.push({ text: right[1], indent: 0, ...para, selah: true });
			return;
		}
		splitSelah(text).forEach((part, k) => {
			const flag = k === 0 ? para : {};
			if (part.selah) lines.push({ text: part.text, indent: 0, ...flag, selah: true });
			else lines.push({ text: part.text, indent: style.indent, ...flag });
		});
		this.lastIndent = style.indent;
	}

	private emitSelah(): void {
		this.capture = null;
		const text = clean(this.captured).replace(/[\s.,:;—–-]+$/, '');
		if (!this.verse || !/\bSelah$/.test(text)) this.fail(`unexpected \\qs content "${text}"`);
		this.verse.lines.push({ text, indent: 0, selah: true });
	}

	private finishTitle(): void {
		if (this.capture !== 'title') return;
		this.capture = null;
		const text = clean(this.captured);
		if (!text) return; // BSB Zechariah 12 has an empty \d
		if (/^[A-Z ]+$/.test(text)) return; // acrostic letter in WEB Psalm 119 ("ALEPH")
		if (this.chapters[this.chapters.length - 1]?.length) {
			this.fail(`title after verse 1: "${text}"`);
		}
		this.title = text;
	}

	/** Ends the open line and any title before a paragraph, verse or chapter starts. */
	private boundary(): void {
		this.finishTitle();
		if (this.chars.length) this.fail(`unclosed \\${this.chars[this.chars.length - 1]}`);
		this.closeLine();
	}

	private endVerse(): void {
		if (this.verse && this.verse.lines.length === 0) this.fail('verse has no text');
	}

	private chapter(arg: string): void {
		this.boundary();
		this.endVerse();
		if (this.title !== null) this.fail('psalm title with no verse after it');
		if (Number(arg) !== this.chapters.length + 1) this.fail(`chapter "${arg}" out of sequence`);
		this.chapters.push([]);
		this.verse = null;
		this.pending = null;
		this.blank = false;
		this.chapterStart = true;
	}

	private startVerse(arg: string): void {
		this.boundary();
		this.endVerse();
		if (/^\d+[-–,]\d+$/.test(arg)) this.fail(`verse bridge \\v ${arg} is not supported`);
		if (!/^\d+$/.test(arg)) this.fail(`invalid verse number "${arg}"`);
		const verses = this.chapters[this.chapters.length - 1];
		if (!verses) this.fail(`verse ${arg} before any chapter`);
		const v = Number(arg);
		const previous = verses[verses.length - 1];
		if (previous && v <= previous.v) this.fail(`verse ${v} out of order after ${previous.v}`);
		this.verse = { v, lines: [] };
		if (this.title !== null) {
			if (v !== 1) this.fail(`psalm title before verse ${v}`);
			this.verse.title = this.title;
			this.title = null;
		}
		verses.push(this.verse);
	}
}

/** Compact JSON with a fixed key order, so regenerated files diff cleanly. */
export function serializeBook(book: BookText): string {
	const ordered = {
		book: book.book,
		translation: book.translation,
		chapters: book.chapters.map((verses) =>
			verses.map((v) => ({
				v: v.v,
				...(v.title !== undefined ? { title: v.title } : {}),
				lines: v.lines.map((l) => ({
					text: l.text,
					indent: l.indent,
					...(l.paragraph ? { paragraph: true } : {}),
					...(l.selah ? { selah: true } : {})
				}))
			}))
		)
	};
	return JSON.stringify(ordered) + '\n';
}

/** Book code to the highest verse number of each chapter. */
export function versificationOf(books: BookText[]): Versification {
	const out: Versification = {};
	for (const b of books) out[b.book] = b.chapters.map((vs) => vs[vs.length - 1]?.v ?? 0);
	return out;
}

// ---------------------------------------------------------------------------------------------
// I/O

/** eBible.org USFM downloads. Licence (from each details page): Public Domain. */
export const SOURCES: Record<TranslationId, string> = {
	bsb: 'https://eBible.org/Scriptures/engbsb_usfm.zip',
	// The Protestant edition, which renders the divine name "LORD" (eng-web says "Yahweh").
	web: 'https://eBible.org/Scriptures/engwebp_usfm.zip',
	kjv: 'https://eBible.org/Scriptures/eng-kjv2006_usfm.zip'
};

async function main(): Promise<void> {
	const fs = await import('node:fs');
	const path = await import('node:path');
	const { unzipSync, strFromU8 } = await import('fflate');
	const root = path.resolve(import.meta.dirname, '..');
	const cache = path.join(root, '.cache', 'usfm');
	const refresh = process.argv.includes('--refresh');
	fs.mkdirSync(cache, { recursive: true });

	const versification: Partial<Record<TranslationId, Versification>> = {};
	for (const [translation, url] of Object.entries(SOURCES) as [TranslationId, string][]) {
		const zipPath = path.join(cache, path.basename(url));
		if (refresh || !fs.existsSync(zipPath)) {
			console.log(`downloading ${url}`);
			const res = await fetch(url);
			if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
			fs.writeFileSync(zipPath, new Uint8Array(await res.arrayBuffer()));
		}
		const entries = unzipSync(fs.readFileSync(zipPath));
		const books: BookText[] = [];
		const skipped: string[] = [];
		for (const [name, data] of Object.entries(entries)) {
			const code = /^\d+-([0-9A-Z]{3})/.exec(path.basename(name))?.[1];
			if (!name.endsWith('.usfm') || !code || !BOOK_CODES.includes(code)) {
				skipped.push(name);
				continue;
			}
			const book = parseUsfm(strFromU8(data), translation);
			if (book.book !== code) throw new Error(`${name}: \\id says ${book.book}`);
			books.push(book);
		}
		books.sort((a, b) => BOOK_CODES.indexOf(a.book) - BOOK_CODES.indexOf(b.book));
		const missing = BOOK_CODES.filter((c) => !books.some((b) => b.book === c));
		if (missing.length) throw new Error(`${translation}: missing books ${missing.join(' ')}`);

		const out = path.join(root, 'static', 'text', translation);
		fs.rmSync(out, { recursive: true, force: true });
		fs.mkdirSync(out, { recursive: true });
		for (const book of books) {
			fs.writeFileSync(path.join(out, `${book.book}.json`), serializeBook(book));
		}
		versification[translation] = versificationOf(books);
		console.log(`${translation}: wrote ${books.length} books; skipped ${skipped.join(', ')}`);
	}

	const prettier = await import('prettier');
	const file = path.join(root, 'src', 'lib', 'core', 'versification.json');
	const options = (await prettier.resolveConfig(file)) ?? {};
	const json = await prettier.format(JSON.stringify(versification), { ...options, filepath: file });
	fs.writeFileSync(file, json);
	console.log(`wrote ${path.relative(root, file)}`);
}

const entry = process.argv[1] && (await import('node:url')).pathToFileURL(process.argv[1]).href;
if (import.meta.url === entry) await main();
