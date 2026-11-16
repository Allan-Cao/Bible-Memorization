/**
 * The whole path from a deck definition to the notes of one export, without I/O:
 * list text -> groups of References -> Passages -> NoteSpecs.
 * The caller supplies `loadBooks`, writes the package (anki/apkg.ts) and bumps `def.revision`.
 */

import { makeNotes } from './cards.ts';
import { cleanDeckName } from './deckdef.ts';
import { parseList } from './list.ts';
import type {
	BookId,
	BookText,
	DeckBuild,
	DeckDefinition,
	Group,
	ListError,
	Passage,
	TranslationId
} from './model.ts';
import { booksNeeded, passageFromBooks } from './sources/static.ts';
import { versificationFor } from './versification.ts';

export type LoadBooks = (
	translation: TranslationId,
	bookIds: BookId[]
) => Promise<Record<BookId, BookText>>;

export interface BuildResult {
	build: DeckBuild;
	groups: Group[];
	/** In deck order, for the preview. */
	passages: Passage[];
	/** Invalid list lines. The valid lines are still built. */
	errors: ListError[];
	/** Verse keys whose saved breaks no longer match the text, so automatic breaks were used. */
	staleBreaks: string[];
}

export async function buildDeck(
	def: DeckDefinition,
	loadBooks: LoadBooks,
	exportedAt: number
): Promise<BuildResult> {
	const { groups, errors } = parseList(def.list, versificationFor(def.translation));
	const refs = groups.flatMap((g) => g.refs);
	const books = await loadBooks(def.translation, booksNeeded(refs));
	const passages = refs.map((ref) => passageFromBooks(ref, def.translation, books));
	const { notes, staleBreaks } = makeNotes(def, passages);
	const build = { deckId: def.id, deckName: cleanDeckName(def.name), notes, exportedAt };
	return { build, groups, passages, errors, staleBreaks };
}
