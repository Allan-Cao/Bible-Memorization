/**
 * Shared types for the core. Types only: no logic lives here.
 *
 * The pipeline is: list text -> References -> Passages -> Units -> NoteSpecs -> .apkg
 */

export type TranslationId = 'bsb' | 'web' | 'kjv';

/** USFM book code, e.g. 'GEN', 'PSA', 'JHN', '1JN'. */
export type BookId = string;

export interface VerseRef {
	book: BookId;
	chapter: number;
	verse: number;
}

/** Inclusive range within one book. A single verse has start equal to end. */
export interface RefRange {
	start: VerseRef;
	end: VerseRef;
}

/** One entry of a deck's list, e.g. "John 14:1-3, 6". */
export interface Reference {
	/** Normalized display form: full book name, e.g. "Psalm 23" or "John 14:1-3, 6". */
	label: string;
	ranges: RefRange[];
}

export interface ListError {
	/** 1-based line number in the list text. */
	line: number;
	input: string;
	message: string;
}

/** References under one `#` heading of the list text. `heading` is null before the first heading. */
export interface Group {
	heading: string | null;
	refs: Reference[];
}

/** One printed line of a verse. Prose verses have a single line with indent 0. */
export interface Line {
	text: string;
	/** Poetry indent level. 0 for prose and for first-level poetry lines. */
	indent: 0 | 1 | 2 | 3;
	/** Set when this line starts a new paragraph or stanza. */
	paragraph?: true;
	/** Set when the line is a liturgical marker such as "Selah". */
	selah?: true;
}

export interface Verse {
	ref: VerseRef;
	lines: Line[];
	/** Psalm superscription, attached to the first verse of the psalm. */
	title?: string;
	/** Set when this translation leaves the verse out (lines is then empty). */
	omitted?: true;
}

export interface Passage {
	ref: Reference;
	translation: TranslationId;
	verses: Verse[];
}

/** Bible text for one book as stored in static/text/{translation}/{BOOK}.json. */
export interface BookText {
	book: BookId;
	translation: TranslationId;
	/** chapters[0] is chapter 1. Omitted verses are simply absent. */
	chapters: StoredVerse[][];
}

export interface StoredVerse {
	v: number;
	lines: Line[];
	title?: string;
}

/**
 * A manual break inside a verse. Words are counted across the whole verse,
 * splitting on whitespace, starting at 0. The break sits after word `after`.
 * `word` is that word, kept so a break can be detected as stale if the text changes.
 */
export interface Break {
	after: number;
	word: string;
}

/** The source of truth for a deck. Everything else is derived from it. */
export interface DeckDefinition {
	v: 1;
	/** Random, assigned at creation, never changes. Namespaces note GUIDs and tags. */
	id: string;
	name: string;
	translation: TranslationId;
	/** One reference per line, `#` lines are headings. */
	list: string;
	/** Key is "BOOK.chapter.verse", e.g. "JHN.3.16". Missing key: automatic. Empty array: never split. */
	breaks: Record<string, Break[]>;
	/** Incremented on every export. */
	revision: number;
}

/** The part of a verse asked by one card. Most verses are a single unit. */
export interface Unit {
	verse: VerseRef;
	/** 0-based position within the verse. */
	index: number;
	/** Number of units the verse was split into. */
	count: number;
	lines: Line[];
}

/** The note type's fields. This list is frozen: changing it breaks updates for existing users. */
export interface NoteFields {
	Reference: string;
	Context: string;
	Answer: string;
	Hint: string;
	Info: string;
}

export interface NoteSpec {
	/** Stable identity. Derived from deck id, translation, verse and unit index, never from text. */
	guid: string;
	/** 0-based position in the deck. New cards are introduced in this order. */
	order: number;
	tags: string[];
	fields: NoteFields;
}

export interface DeckBuild {
	deckId: string;
	deckName: string;
	notes: NoteSpec[];
	/** Unix time in seconds. Used as every note's modification time. */
	exportedAt: number;
}
