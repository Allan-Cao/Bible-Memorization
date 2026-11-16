/**
 * Parses a deck's list text: one reference per line, `#` lines start a group.
 * Invalid lines become errors with 1-based line numbers; parsing carries on past them.
 */

import type { Group, ListError, Versification } from './model.ts';
import { parseReference } from './refs.ts';

export function parseList(
	text: string,
	versification: Versification
): { groups: Group[]; errors: ListError[] } {
	const groups: Group[] = [];
	const errors: ListError[] = [];
	const seen = new Map<string, number>(); // normalized label -> line it first appeared on
	let current: Group = { heading: null, refs: [] };

	const lines = text.split(/\r?\n/);
	for (let i = 0; i < lines.length; i++) {
		const input = lines[i].trim();
		const line = i + 1;
		if (!input) continue;

		if (input.startsWith('#')) {
			if (current.refs.length > 0) groups.push(current);
			current = { heading: input.replace(/^#+/, '').trim(), refs: [] };
			continue;
		}

		try {
			const ref = parseReference(input, versification);
			const first = seen.get(ref.label);
			if (first !== undefined) throw new Error(`${ref.label} is already listed on line ${first}`);
			seen.set(ref.label, line);
			current.refs.push(ref);
		} catch (e) {
			errors.push({ line, input, message: e instanceof Error ? e.message : String(e) });
		}
	}
	if (current.refs.length > 0) groups.push(current);
	return { groups, errors };
}
