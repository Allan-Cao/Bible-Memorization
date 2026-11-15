/** Display names for the supported translations, in the order the picker lists them. */

import type { TranslationId } from './model.ts';

export interface Translation {
	id: TranslationId;
	/** e.g. "BSB", shown on cards. */
	short: string;
	/** e.g. "Berean Standard Bible", shown in the picker. */
	name: string;
}

export const TRANSLATIONS: Record<TranslationId, Translation> = {
	bsb: { id: 'bsb', short: 'BSB', name: 'Berean Standard Bible' },
	web: { id: 'web', short: 'WEB', name: 'World English Bible' },
	kjv: { id: 'kjv', short: 'KJV', name: 'King James Version' }
};
