/**
 * The 66 books of the Protestant canon, in canonical order, and a lookup by name or abbreviation.
 * Ids are USFM book codes.
 */

export interface Book {
	/** USFM book code, e.g. 'JHN'. */
	id: string;
	/** Display name used in normalized labels, e.g. 'Psalm'. */
	name: string;
	/** Accepted spellings besides `name`. Numbered books list the "1 John" style only; see findBook. */
	aliases: string[];
	/** The book has one chapter, so references and labels leave the chapter out ("Jude 5"). */
	singleChapter?: true;
}

// Deliberately absent: 'Jud' (Judges or Jude), 'Ph' (Philippians or Philemon), 'Ez' (Ezra or Ezekiel),
// bare 'Jo' and 'Co'. Ambiguous input is rejected rather than guessed.
export const BOOKS: Book[] = [
	{ id: 'GEN', name: 'Genesis', aliases: ['Gen', 'Ge', 'Gn'] },
	{ id: 'EXO', name: 'Exodus', aliases: ['Exod', 'Exo', 'Ex'] },
	{ id: 'LEV', name: 'Leviticus', aliases: ['Lev', 'Le', 'Lv'] },
	{ id: 'NUM', name: 'Numbers', aliases: ['Num', 'Nu', 'Nm', 'Nb'] },
	{ id: 'DEU', name: 'Deuteronomy', aliases: ['Deut', 'De', 'Dt'] },
	{ id: 'JOS', name: 'Joshua', aliases: ['Josh', 'Jos', 'Jsh'] },
	{ id: 'JDG', name: 'Judges', aliases: ['Judg', 'Jdg', 'Jg', 'Jdgs'] },
	{ id: 'RUT', name: 'Ruth', aliases: ['Rut', 'Ru'] },
	{ id: '1SA', name: '1 Samuel', aliases: ['1 Sam', '1 Sa', '1 Sm'] },
	{ id: '2SA', name: '2 Samuel', aliases: ['2 Sam', '2 Sa', '2 Sm'] },
	{ id: '1KI', name: '1 Kings', aliases: ['1 Kgs', '1 Ki', '1 Kin'] },
	{ id: '2KI', name: '2 Kings', aliases: ['2 Kgs', '2 Ki', '2 Kin'] },
	{ id: '1CH', name: '1 Chronicles', aliases: ['1 Chron', '1 Chr', '1 Ch'] },
	{ id: '2CH', name: '2 Chronicles', aliases: ['2 Chron', '2 Chr', '2 Ch'] },
	{ id: 'EZR', name: 'Ezra', aliases: ['Ezr'] },
	{ id: 'NEH', name: 'Nehemiah', aliases: ['Neh', 'Ne'] },
	{ id: 'EST', name: 'Esther', aliases: ['Esth', 'Est', 'Es'] },
	{ id: 'JOB', name: 'Job', aliases: ['Jb'] },
	{ id: 'PSA', name: 'Psalm', aliases: ['Psalms', 'Ps', 'Psa', 'Pss', 'Psm', 'Pslm'] },
	{ id: 'PRO', name: 'Proverbs', aliases: ['Prov', 'Pro', 'Prv', 'Pr'] },
	{ id: 'ECC', name: 'Ecclesiastes', aliases: ['Eccles', 'Eccl', 'Ecc', 'Ec', 'Qoh'] },
	{
		id: 'SNG',
		name: 'Song of Songs',
		aliases: [
			'Song of Solomon',
			'Song of Sol',
			'Song',
			'SoS',
			'SS',
			'Canticles',
			'Canticle of Canticles'
		]
	},
	{ id: 'ISA', name: 'Isaiah', aliases: ['Isa', 'Is'] },
	{ id: 'JER', name: 'Jeremiah', aliases: ['Jer', 'Je', 'Jr'] },
	{ id: 'LAM', name: 'Lamentations', aliases: ['Lam', 'La'] },
	{ id: 'EZK', name: 'Ezekiel', aliases: ['Ezek', 'Eze', 'Ezk'] },
	{ id: 'DAN', name: 'Daniel', aliases: ['Dan', 'Da', 'Dn'] },
	{ id: 'HOS', name: 'Hosea', aliases: ['Hos', 'Ho'] },
	{ id: 'JOL', name: 'Joel', aliases: ['Joe', 'Jl'] },
	{ id: 'AMO', name: 'Amos', aliases: ['Am'] },
	{ id: 'OBA', name: 'Obadiah', aliases: ['Obad', 'Oba', 'Ob'], singleChapter: true },
	{ id: 'JON', name: 'Jonah', aliases: ['Jnh', 'Jon'] },
	{ id: 'MIC', name: 'Micah', aliases: ['Mic', 'Mc'] },
	{ id: 'NAM', name: 'Nahum', aliases: ['Nah', 'Na'] },
	{ id: 'HAB', name: 'Habakkuk', aliases: ['Hab', 'Hb'] },
	{ id: 'ZEP', name: 'Zephaniah', aliases: ['Zeph', 'Zep', 'Zp'] },
	{ id: 'HAG', name: 'Haggai', aliases: ['Hag', 'Hg'] },
	{ id: 'ZEC', name: 'Zechariah', aliases: ['Zech', 'Zec', 'Zc'] },
	{ id: 'MAL', name: 'Malachi', aliases: ['Mal', 'Ml'] },
	{ id: 'MAT', name: 'Matthew', aliases: ['Matt', 'Mt'] },
	{ id: 'MRK', name: 'Mark', aliases: ['Mrk', 'Mar', 'Mk'] },
	{ id: 'LUK', name: 'Luke', aliases: ['Luk', 'Lk'] },
	{ id: 'JHN', name: 'John', aliases: ['Jhn', 'Jn'] },
	{ id: 'ACT', name: 'Acts', aliases: ['Act', 'Ac'] },
	{ id: 'ROM', name: 'Romans', aliases: ['Rom', 'Ro', 'Rm'] },
	{ id: '1CO', name: '1 Corinthians', aliases: ['1 Cor', '1 Co'] },
	{ id: '2CO', name: '2 Corinthians', aliases: ['2 Cor', '2 Co'] },
	{ id: 'GAL', name: 'Galatians', aliases: ['Gal', 'Ga'] },
	{ id: 'EPH', name: 'Ephesians', aliases: ['Eph', 'Ephes'] },
	{ id: 'PHP', name: 'Philippians', aliases: ['Phil', 'Php', 'Pp'] },
	{ id: 'COL', name: 'Colossians', aliases: ['Col'] },
	{ id: '1TH', name: '1 Thessalonians', aliases: ['1 Thess', '1 Thes', '1 Th'] },
	{ id: '2TH', name: '2 Thessalonians', aliases: ['2 Thess', '2 Thes', '2 Th'] },
	{ id: '1TI', name: '1 Timothy', aliases: ['1 Tim', '1 Ti'] },
	{ id: '2TI', name: '2 Timothy', aliases: ['2 Tim', '2 Ti'] },
	{ id: 'TIT', name: 'Titus', aliases: ['Tit', 'Ti'] },
	{ id: 'PHM', name: 'Philemon', aliases: ['Philem', 'Phm', 'Pm'], singleChapter: true },
	{ id: 'HEB', name: 'Hebrews', aliases: ['Heb'] },
	{ id: 'JAS', name: 'James', aliases: ['Jas', 'Jm'] },
	{ id: '1PE', name: '1 Peter', aliases: ['1 Pet', '1 Pe', '1 Pt'] },
	{ id: '2PE', name: '2 Peter', aliases: ['2 Pet', '2 Pe', '2 Pt'] },
	{ id: '1JN', name: '1 John', aliases: ['1 Jn', '1 Jhn', '1 Jo'] },
	{ id: '2JN', name: '2 John', aliases: ['2 Jn', '2 Jhn', '2 Jo'], singleChapter: true },
	{ id: '3JN', name: '3 John', aliases: ['3 Jn', '3 Jhn', '3 Jo'], singleChapter: true },
	{ id: 'JUD', name: 'Jude', aliases: ['Jde'], singleChapter: true },
	{ id: 'REV', name: 'Revelation', aliases: ['Rev', 'Re', 'Revelations', 'The Revelation'] }
];

/** Lowercase with spaces and periods removed, so "1 Jn." and "1jn" compare equal. */
function squash(text: string): string {
	return text.toLowerCase().replace(/[\s.]/g, '');
}

const byKey = new Map<string, Book>();
for (const book of BOOKS) {
	for (const text of [book.name, ...book.aliases]) byKey.set(squash(text), book);
}

/** "I John", "First John", "1st John" -> "1 John". Roman numerals need a space after them. */
function withDigitPrefix(input: string): string {
	return input
		.trim()
		.replace(/^(first|1st|i)\s+/i, '1 ')
		.replace(/^(second|2nd|ii)\s+/i, '2 ')
		.replace(/^(third|3rd|iii)\s+/i, '3 ');
}

/** Case-insensitive lookup by name or abbreviation. Undefined when unknown. */
export function findBook(input: string): Book | undefined {
	return byKey.get(squash(withDigitPrefix(input)));
}

/** True for the five one-chapter books (Obadiah, Philemon, 2 John, 3 John, Jude). */
export function isSingleChapter(bookId: string): boolean {
	return BOOKS.some((book) => book.id === bookId && book.singleChapter);
}
