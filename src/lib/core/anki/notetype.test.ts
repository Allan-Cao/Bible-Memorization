import { createHash } from 'node:crypto';
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { NoteFields } from '../model.ts';
import {
	FIELD_NAMES,
	MODEL_ID,
	MODEL_NAME,
	NOTETYPE_MOD,
	TEMPLATE_VERSION,
	noteTypeJson
} from './notetype.ts';

describe('note type', () => {
	it('has a fixed numeric id and name', () => {
		expect(Number.isSafeInteger(MODEL_ID)).toBe(true);
		expect(MODEL_ID).toBe(1_794_614_401); // frozen forever: changing it stops existing decks updating in place
		expect(MODEL_NAME).toBe('Bible Memorization');
		const json = noteTypeJson(123);
		expect(json.id).toBe(MODEL_ID);
		expect(json.name).toBe(MODEL_NAME);
		expect(json.type).toBe(0);
	});

	it('has exactly the frozen fields in order', () => {
		expect(FIELD_NAMES).toEqual(['Reference', 'Context', 'Answer', 'Hint', 'Info']);
		const json = noteTypeJson(123);
		expect(json.flds.map((f) => f.name)).toEqual(FIELD_NAMES);
		expect(json.flds.map((f) => f.ord)).toEqual([0, 1, 2, 3, 4]);
		// Checked by `npm run check`: the list matches NoteFields in model.ts.
		expectTypeOf<(typeof FIELD_NAMES)[number]>().toEqualTypeOf<keyof NoteFields>();
	});

	it('sorts by Reference', () => {
		expect(noteTypeJson(123).sortf).toBe(0);
	});

	it('uses the given deck as default deck', () => {
		expect(noteTypeJson(123).did).toBe(123);
	});

	it('has a modification time that depends only on the template version', () => {
		expect(TEMPLATE_VERSION).toBe(2);
		// The Unix time of the latest template change, set by hand with TEMPLATE_VERSION.
		expect(NOTETYPE_MOD).toBe(1_794_808_514);
		expect(noteTypeJson(1).mod).toBe(NOTETYPE_MOD);
		expect(noteTypeJson(2).mod).toBe(NOTETYPE_MOD);
	});

	it('pins the template and CSS to the version and mod time', () => {
		// If this fails, you changed the question template, answer template or CSS. Then
		// TEMPLATE_VERSION and NOTETYPE_MOD (`date +%s`) must change too, or the update never
		// reaches users. Update all three values below together.
		const json = noteTypeJson(1);
		const hash = createHash('sha256')
			.update(JSON.stringify([json.tmpls[0].qfmt, json.tmpls[0].afmt, json.css]))
			.digest('hex');
		expect({ hash, version: TEMPLATE_VERSION, mod: NOTETYPE_MOD }).toEqual({
			hash: '31d257e7c8f5ecb611aa377853c50bcbf6f9295116420f26e324ac4efc91cbef',
			version: 2,
			mod: 1_794_808_514
		});
	});

	describe('template', () => {
		const [tmpl, ...rest] = noteTypeJson(123).tmpls;

		it('is a single card template', () => {
			expect(rest).toEqual([]);
			expect(tmpl.ord).toBe(0);
		});

		it('front shows Reference, then optional Context, then the built-in hint', () => {
			const q = tmpl.qfmt;
			const ref = q.indexOf('{{Reference}}');
			const ctx = q.indexOf('{{#Context}}');
			const hint = q.indexOf('{{#Hint}}');
			expect(ref).toBeGreaterThanOrEqual(0);
			expect(ctx).toBeGreaterThan(ref);
			expect(hint).toBeGreaterThan(ctx);
			expect(q).toContain('<div class="context">{{Context}}</div>');
			expect(q).toContain('{{hint:Hint}}');
			expect(q).toContain('{{/Hint}}');
			expect(q).not.toContain('{{Answer}}');
		});

		it('back shows the front, a divider, the Answer, then optional Info', () => {
			const a = tmpl.afmt;
			const front = a.indexOf('{{FrontSide}}');
			const hr = a.indexOf('<hr id="answer">');
			const answer = a.indexOf('{{Answer}}');
			const info = a.indexOf('{{#Info}}');
			expect(front).toBe(0);
			expect(hr).toBeGreaterThan(front);
			expect(answer).toBeGreaterThan(hr);
			expect(info).toBeGreaterThan(answer);
			expect(a).toContain('<div class="info">{{Info}}</div>');
		});
	});

	describe('css', () => {
		const css = noteTypeJson(123).css;

		it('sets no colours, backgrounds or fonts', () => {
			expect(css).not.toMatch(/color/i);
			expect(css).not.toMatch(/background/i);
			expect(css).not.toMatch(/font-family/i);
			expect(css).not.toMatch(/\.card\b/);
			expect(css).not.toMatch(/font-size:\s*[\d.]+(px|pt)/);
		});

		it('styles every documented class', () => {
			for (const cls of [
				'line',
				'i1',
				'i2',
				'i3',
				'para',
				'vn',
				'title',
				'selah',
				'context',
				'info'
			]) {
				expect(css).toMatch(new RegExp(`\\.${cls}\\b`));
			}
		});

		it('makes lines blocks and dims the lead-in with opacity', () => {
			expect(css).toMatch(/\.line\s*\{[^}]*display:\s*block/);
			expect(css).toMatch(/\.context\s*\{[^}]*opacity:/);
		});
	});
});
