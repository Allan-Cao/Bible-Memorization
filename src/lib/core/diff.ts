/**
 * What changed between two exports, and the Anki search that finds notes left over from removed
 * passages (Anki never deletes notes on import).
 */

import type { DeckDefinition } from './model.ts';

interface Snapshot {
	labels: string[];
	guids: string[];
}

/** `previous` is the snapshot saved at the last export, or null if there was none. */
export function diffExport(previous: Snapshot | null, next: Snapshot) {
	const before = previous ?? { labels: [], guids: [] };
	const labels = new Set(before.labels);
	const guids = new Set(before.guids);
	const nextLabels = new Set(next.labels);
	const nextGuids = new Set(next.guids);
	return {
		addedPassages: next.labels.filter((label) => !labels.has(label)),
		removedPassages: before.labels.filter((label) => !nextLabels.has(label)),
		addedNotes: next.guids.filter((guid) => !guids.has(guid)).length,
		removedNotes: before.guids.filter((guid) => !nextGuids.has(guid)).length,
		firstExport: previous === null
	};
}

/** Put on every note of an export, so older revisions can be told apart. */
export function revisionTag(def: DeckDefinition): string {
	return `bm::${def.id}::r${def.revision}`;
}

/** Anki search for this deck's notes from earlier revisions, i.e. those no longer in the list. */
export function cleanupSearch(def: DeckDefinition): string {
	return `tag:bm::${def.id}::* -tag:${revisionTag(def)}`;
}
