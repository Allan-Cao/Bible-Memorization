/**
 * The single Anki note type used by every deck this app exports.
 *
 * Field HTML contract (for the module that renders NoteFields):
 *
 * - Every field value is HTML and is stored exactly as given. Escape `<`, `>` and `&` in text.
 * - `.line`     one printed line of a verse: `<div class="line">...</div>`. Prose verses are one line.
 *               Put each line in its own element; do not use `<br>` between lines.
 * - `.i1` `.i2` `.i3`  poetry indent levels 1 to 3, added next to `.line`
 *               (`<div class="line i2">`). Level 0 has no class.
 * - `.para`     added next to `.line` when the line starts a paragraph or stanza (extra space before it).
 * - `.vn`       verse number marker, inline at the start of a line: `<span class="vn">16</span>`.
 * - `.selah`    added next to `.line` for a Selah line, which is shown but not recited.
 * - `.title`    added next to `.line` for a psalm title, which stands in the Context field
 *               where the lead-in would be.
 * - `.context`  the lead-in wrapper. The template already wraps the Context field in
 *               `<div class="context">`, so the Context field itself holds only `.line` elements.
 * - `.info`     small text at the bottom of the back. The template already wraps the Info field in
 *               `<div class="info">`, so the Info field holds plain inline HTML.
 * - Hint holds `.line` elements like Answer, with each word cut to its first letter.
 *   Anki's `{{hint:Hint}}` shows it behind a "Hint" link.
 * - Reference is plain text (e.g. "John 3:16"). It is the sort field, so keep markup out of it.
 * - Never set colours, fonts or sizes inline: cards must inherit Anki's font, colours and night mode.
 *
 * Changing the template or CSS: bump TEMPLATE_VERSION, so Anki sees a newer note type and
 * replaces the old one on import. Never change MODEL_ID or FIELD_NAMES.
 */

/** Fixed forever. Anki identifies the note type by this id across every deck and export. */
export const MODEL_ID = 1_794_614_401;

export const MODEL_NAME = 'Bible Memorization';

/**
 * FROZEN FOREVER: the names and order of the fields. Anki only updates notes in place when the
 * incoming note type has the same fields as the one already in the collection. Changing this
 * list strands every existing user's review history. Must match `NoteFields` in model.ts.
 */
export const FIELD_NAMES = ['Reference', 'Context', 'Answer', 'Hint', 'Info'] as const;

/** Bump on every change to QFMT, AFMT or CSS. */
export const TEMPLATE_VERSION = 2;

/**
 * The note type's modification time (seconds). Anki's default import option replaces an existing
 * note type only if the incoming one is newer, so this must grow with TEMPLATE_VERSION and must
 * never depend on the export time. Base is 2026-11-14T00:00:00Z; each version adds one second.
 */
export const NOTETYPE_MOD = 1_794_614_400 + TEMPLATE_VERSION;

const QFMT = `<div class="reference">{{Reference}}</div>
{{#Context}}<div class="context">{{Context}}</div>{{/Context}}
{{#Hint}}<div class="hint-wrap">{{hint:Hint}}</div>{{/Hint}}`;

const AFMT = `{{FrontSide}}
<hr id="answer">
<div class="answer">{{Answer}}</div>
{{#Info}}<div class="info">{{Info}}</div>{{/Info}}`;

/** Structural only: no colours, backgrounds, font families or absolute font sizes. */
const CSS = `.line { display: block; }
.i1 { padding-left: 1.5em; }
.i2 { padding-left: 3em; }
.i3 { padding-left: 4.5em; }
.para { margin-top: 0.75em; }
.vn { font-size: 0.6em; vertical-align: super; line-height: 0; opacity: 0.7; padding-right: 0.15em; }
.title, .selah { font-style: italic; font-size: 0.85em; }
.selah { opacity: 0.7; }
.context { opacity: 0.6; margin-top: 0.5em; }
.hint-wrap { margin-top: 0.75em; }
.info { font-size: 0.75em; opacity: 0.7; margin-top: 1.5em; }
`;

export interface FieldJson {
	name: string;
	ord: number;
	sticky: boolean;
	rtl: boolean;
	font: string;
	size: number;
	media: string[];
}

export interface TemplateJson {
	name: string;
	ord: number;
	qfmt: string;
	afmt: string;
	bqfmt: string;
	bafmt: string;
	did: null;
	bfont: string;
	bsize: number;
}

export interface NoteTypeJson {
	id: number;
	name: string;
	type: 0;
	mod: number;
	usn: number;
	sortf: number;
	did: number;
	tmpls: TemplateJson[];
	flds: FieldJson[];
	css: string;
	latexPre: string;
	latexPost: string;
	latexsvg: boolean;
	req: [number, 'all' | 'any', number[]][];
	tags: string[];
	vers: never[];
}

/** The note type as stored in the `models` column of a schema 11 collection. */
export function noteTypeJson(deckId: number): NoteTypeJson {
	return {
		id: MODEL_ID,
		name: MODEL_NAME,
		type: 0,
		mod: NOTETYPE_MOD,
		usn: -1,
		sortf: 0,
		did: deckId,
		tmpls: [
			{
				name: 'Recall',
				ord: 0,
				qfmt: QFMT,
				afmt: AFMT,
				bqfmt: '',
				bafmt: '',
				did: null,
				bfont: '',
				bsize: 0
			}
		],
		// font and size are the editor's defaults for the field, not card styling.
		flds: FIELD_NAMES.map((name, ord) => ({
			name,
			ord,
			sticky: false,
			rtl: false,
			font: 'Arial',
			size: 20,
			media: []
		})),
		css: CSS,
		latexPre:
			'\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage[utf8]{inputenc}\n' +
			'\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0in}\n' +
			'\\begin{document}\n',
		latexPost: '\\end{document}',
		latexsvg: false,
		// The front always shows Reference, so a card exists whenever Reference is non-empty.
		req: [[0, 'all', [0]]],
		tags: [],
		vers: []
	};
}
