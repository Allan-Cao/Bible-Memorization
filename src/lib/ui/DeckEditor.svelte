<script lang="ts">
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { BuildResult } from '#lib/core/build.ts';
	import { buildDeck } from '#lib/core/build.ts';
	import { cleanDeckName } from '#lib/core/deckdef.ts';
	import { previewDeck } from '#lib/core/editor.ts';
	import type { Break, DeckDefinition, TranslationId } from '#lib/core/model.ts';
	import { verseLabel } from '#lib/core/refs.ts';
	import { TRANSLATIONS } from '#lib/core/translations.ts';
	import { exportDeck, loadBooks, type ExportReport } from './browser.ts';
	import ConfirmDialog from './ConfirmDialog.svelte';
	import ExportDialog from './ExportDialog.svelte';
	import PassagePanel from './PassagePanel.svelte';
	import ShareDialog from './ShareDialog.svelte';
	import { deckStored, loadDeck, loadExport, saveDeck, watchDeck } from './storage.ts';
	import { button, field, label, muted, notice, primary } from './styles.ts';
	import TranslationSelect from './TranslationSelect.svelte';

	let { initial }: { initial: DeckDefinition } = $props();

	// The editor keeps its own copy; the page remounts it for another deck.
	const def = $state(untrack(() => structuredClone(initial)));
	let exported = $state(loadExport(def.id));
	/** The browser refused to store the deck, so it lasts only as long as this page. */
	let unsaved = $state(false);
	$effect(() => {
		const snapshot = $state.snapshot(def);
		// Saving what is stored already would send a change taken from another tab back to it.
		if (JSON.stringify(snapshot) !== JSON.stringify(loadDeck(def.id))) saveDeck(snapshot);
		unsaved = !deckStored(def.id);
	});
	// Another tab may change or delete the deck: take its version rather than save over it.
	$effect(() =>
		watchDeck(def.id, () => {
			const stored = loadDeck(def.id);
			if (!stored) return goto(resolve('/'), { replaceState: true });
			Object.assign(def, stored);
			exported = loadExport(def.id);
		})
	);

	// The list is rebuilt a moment after typing stops; breaks and translation apply at once.
	let list = $state(def.list);
	$effect(() => {
		const text = def.list;
		const timer = setTimeout(() => (list = text), 300);
		return () => clearTimeout(timer);
	});

	let built = $state<{ result: BuildResult; def: DeckDefinition; added: string | null } | null>(
		null
	);
	let buildError = $state('');
	let labels = new Set<string>(); // of the previous build
	$effect(() => {
		// Only what changes the cards: renaming the deck does not rebuild them.
		const d: DeckDefinition = {
			v: 1,
			id: def.id,
			name: '',
			translation: def.translation,
			list,
			breaks: $state.snapshot(def.breaks),
			revision: 0
		};
		let current = true;
		buildDeck(d, loadBooks, 0).then(
			(result) => {
				if (!current) return;
				// A passage added on its own starts open, wherever it is in the list.
				const next = result.passages.map((p) => p.ref.label);
				const fresh = next.filter((label) => !labels.has(label));
				labels = new Set(next);
				[built, buildError] = [{ result, def: d, added: fresh.length === 1 ? fresh[0] : null }, ''];
			},
			(e) => current && (buildError = message(e))
		);
		return () => (current = false);
	});

	const result = $derived(built?.result);
	const groups = $derived(built ? previewDeck(built.def, built.result) : []);
	const verses = $derived(
		groups.flatMap((g) => g.passages.flatMap((p) => p.verses)).filter((v) => v.cards.length).length
	);
	/** Index of each group's first passage across the deck: the first few passages start open. */
	const starts = $derived(
		groups.map((_, i) => groups.slice(0, i).reduce((n, g) => n + g.passages.length, 0))
	);
	const stale = $derived(
		(result?.staleBreaks ?? []).map((key) => {
			const [book, chapter, verse] = key.split('.');
			return verseLabel({ book, chapter: Number(chapter), verse: Number(verse) });
		})
	);
	const blocked = $derived(
		!result
			? 'The cards are still being made.'
			: result.errors.length
				? 'Fix the marked lines in the list to export.'
				: result.build.notes.length === 0
					? 'Add a passage to the list to export.'
					: ''
	);
	const renamed = $derived(exported && cleanDeckName(def.name) !== exported.name);

	function message(e: unknown): string {
		return e instanceof Error ? e.message : String(e);
	}

	function setBreaks(key: string, breaks: Break[] | undefined) {
		if (breaks) def.breaks[key] = breaks;
		else delete def.breaks[key];
	}

	let askTranslation = $state<TranslationId | null>(null);
	function setTranslation(t: TranslationId) {
		def.translation = t;
		def.breaks = {}; // word positions belong to the old text
	}

	let exportOpen = $state(false);
	let report = $state<ExportReport | null>(null);
	let exportError = $state<string | null>(null);
	/** One export at a time: each needs its own revision and compares with the one before. */
	let exporting = $state(false);
	async function runExport() {
		if (exporting) return;
		exporting = true;
		[report, exportError, exportOpen] = [null, null, true];
		// Another tab may have exported since this one loaded the deck.
		const revision = (def.revision = Math.max(def.revision, loadDeck(def.id)?.revision ?? 0) + 1);
		saveDeck($state.snapshot(def));
		try {
			report = await exportDeck($state.snapshot(def));
			exported = loadExport(def.id);
		} catch (e) {
			if (def.revision === revision) def.revision -= 1;
			exportError = message(e);
		} finally {
			exporting = false;
		}
	}

	let shareOpen = $state(false);
</script>

<main class="mx-auto max-w-6xl px-4 py-8">
	<div class="flex flex-wrap items-start justify-between gap-4">
		<h1 class="min-w-0 font-serif text-2xl font-semibold tracking-tight break-words sm:text-3xl">
			{cleanDeckName(def.name)}
		</h1>
		<div class="flex flex-col items-end gap-1">
			<div class="flex gap-2">
				<button type="button" class={button} onclick={() => (shareOpen = true)}>Share</button>
				<button
					type="button"
					class={primary}
					disabled={!!blocked || exporting}
					aria-describedby="export-blocked"
					onclick={runExport}
				>
					Export for Anki
				</button>
			</div>
			<p id="export-blocked" class="text-right text-sm {muted}">{blocked}</p>
		</div>
	</div>

	{#if unsaved}
		<p class="{notice} mt-4">
			This browser did not let the page save this deck, so it is lost when the page is closed or
			reloaded. To keep it, choose Share and then “Download deck file”.
		</p>
	{/if}

	<div class="mt-6 grid gap-10 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
		<section aria-label="Deck" class="space-y-5 lg:sticky lg:top-4 lg:self-start">
			<div>
				<label for="deck-name" class={label}>Name</label>
				<input id="deck-name" class="{field} mt-1" bind:value={def.name} autocomplete="off" />
				{#if renamed && exported}
					<p class="{notice} mt-2">
						This deck is called “{exported.name}” in Anki. Rename it there to “{cleanDeckName(
							def.name
						)}” before importing again, otherwise new cards land in a second deck.
					</p>
				{/if}
			</div>
			<div>
				<label for="deck-translation" class={label}>Translation</label>
				<div class="mt-1">
					<TranslationSelect
						id="deck-translation"
						bind:value={
							() => def.translation,
							(t) => {
								if (t === def.translation) return;
								if (exported) askTranslation = t;
								else setTranslation(t);
							}
						}
					/>
				</div>
			</div>
			<div>
				<label for="deck-list" class={label}>Passages</label>
				<p id="list-help" class="mt-1 text-sm {muted}">
					One per line, for example <code>Psalm 23</code>, <code>John 3:16-18</code> or
					<code>John 14:1-3, 6</code>. A line starting with <code>#</code> is a heading.
				</p>
				<textarea
					id="deck-list"
					class="{field} mt-2 min-h-64 resize-y leading-relaxed"
					rows="12"
					spellcheck="false"
					aria-describedby="list-help list-errors"
					aria-invalid={!!result?.errors.length}
					bind:value={def.list}></textarea>
				<ul id="list-errors" aria-live="polite" class="mt-2 space-y-1 text-sm">
					{#each result?.errors ?? [] as error (error.line)}
						<li class="text-red-700 dark:text-red-400">
							<span class="font-semibold">Line {error.line}:</span>
							{error.message}
						</li>
					{/each}
				</ul>
			</div>
		</section>

		<section aria-labelledby="cards-heading" class="min-w-0">
			<div class="flex flex-wrap items-baseline justify-between gap-x-4">
				<h2 id="cards-heading" class="text-xl font-semibold">Cards</h2>
				{#if result}
					<p class="text-sm {muted}" aria-live="polite">
						{result.passages.length}
						{result.passages.length === 1 ? 'passage' : 'passages'} · {verses}
						{verses === 1 ? 'verse' : 'verses'} · {result.build.notes.length}
						{result.build.notes.length === 1 ? 'card' : 'cards'}
					</p>
				{/if}
			</div>
			{#if buildError}
				<p role="alert" class="mt-3 text-red-700 dark:text-red-400">{buildError}</p>
			{/if}
			{#if stale.length}
				<p class="{notice} mt-3">
					The text of {stale.join(', ')} has changed, so the breaks you set there were dropped and the
					automatic ones are used.
				</p>
			{/if}
			{#if result && groups.length === 0}
				<p class="mt-3 {muted}">Cards appear here as you add passages to the list.</p>
			{/if}
			<div class="mt-4 space-y-6">
				{#each groups as group, g (g)}
					<div>
						{#if group.heading}
							<h3
								class="mb-2 border-b border-stone-200 pb-1 font-serif text-lg font-semibold dark:border-stone-800"
							>
								{group.heading}
							</h3>
						{/if}
						{#each group.passages as passage, p (passage.label)}
							<PassagePanel
								{passage}
								startOpen={starts[g] + p < 3 || passage.label === built?.added}
								level={group.heading ? 4 : 3}
								translation={TRANSLATIONS[def.translation].short}
								onbreaks={setBreaks}
							/>
						{/each}
					</div>
				{/each}
			</div>
		</section>
	</div>
</main>

<ConfirmDialog
	bind:open={() => askTranslation !== null, (open) => !open && (askTranslation = null)}
	title="Change to the {askTranslation ? TRANSLATIONS[askTranslation].short : ''}?"
	description="Your next export will have new cards in the new translation, which start without any progress. You can remove the old cards in Anki afterwards. Breaks you set by hand are cleared."
	confirm="Change translation"
	onconfirm={() => askTranslation && setTranslation(askTranslation)}
/>
<ExportDialog bind:open={exportOpen} {report} error={exportError} />
<ShareDialog bind:open={shareOpen} {def} />
