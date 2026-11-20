<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { encodeShare, newDeck, parseDeckDefinition } from '#lib/core/deckdef.ts';
	import { passageCount } from '#lib/core/editor.ts';
	import type { DeckDefinition, TranslationId } from '#lib/core/model.ts';
	import { TRANSLATIONS } from '#lib/core/translations.ts';
	import ConfirmDialog from '#lib/ui/ConfirmDialog.svelte';
	import { deleteDeck, listDecks, loadExport, saveDeck } from '#lib/ui/storage.ts';
	import { button, field, label, link, muted, primary, quiet } from '#lib/ui/styles.ts';
	import TranslationSelect from '#lib/ui/TranslationSelect.svelte';
	import ot from '../../presets/ot.txt?raw';
	import nt from '../../presets/nt.txt?raw';

	let decks = $state<DeckDefinition[]>([]);
	/** The page is prerendered: until it is running here, its buttons would do nothing or reload. */
	let ready = $state(false);
	onMount(() => {
		decks = listDecks();
		ready = true;
	});

	let name = $state('');
	let translation = $state<TranslationId>('bsb');
	let deleting = $state<DeckDefinition | null>(null);
	let fileError = $state('');

	function exported(def: DeckDefinition): string {
		const at = loadExport(def.id)?.at;
		return at ? `exported ${new Date(at).toLocaleDateString()}` : 'not exported yet';
	}

	function create(deckName: string, list = '') {
		const def = { ...newDeck(deckName.trim(), translation), list };
		saveDeck(def);
		goto(resolve('/deck/[id]', { id: def.id }));
	}

	/** A deck file goes through /open, so a deck that is already here is handled the same way. */
	async function openFile(event: Event & { currentTarget: HTMLInputElement }) {
		const file = event.currentTarget.files?.[0];
		event.currentTarget.value = '';
		if (!file) return;
		fileError = '';
		try {
			const def = parseDeckDefinition(JSON.parse(await file.text()));
			goto(resolve(`/open#${await encodeShare(def)}`));
		} catch (e) {
			fileError = `${file.name} is not a deck file: ${e instanceof Error ? e.message : e}`;
		}
	}
</script>

<main class="mx-auto max-w-2xl space-y-12 px-4 py-10">
	<section>
		<h1 class="font-serif text-3xl font-semibold tracking-tight">Memorize Scripture with Anki</h1>
		<p class="mt-4 text-lg leading-relaxed {muted}">
			Type the passages you want to learn and this page makes flash cards for
			<a class={link} href="https://apps.ankiweb.net/">Anki</a>, one card per verse. Change the list
			whenever you like and download it again: Anki updates your cards and keeps your progress.
			Everything stays in this browser.
		</p>
	</section>

	<section aria-labelledby="decks-heading">
		<h2 id="decks-heading" class="text-xl font-semibold">Your decks</h2>
		{#if decks.length === 0}
			<p class="mt-3 {muted}">You have no decks yet. Make one below or start from an example.</p>
		{:else}
			<ul
				class="mt-3 divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white dark:divide-stone-800 dark:border-stone-800 dark:bg-stone-900"
			>
				{#each decks as def (def.id)}
					<li class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
						<div class="min-w-0">
							<a href={resolve('/deck/[id]', { id: def.id })} class="font-medium break-words {link}"
								>{def.name}</a
							>
							<p class="text-sm {muted}">
								{TRANSLATIONS[def.translation].short} · {passageCount(def)}
								{passageCount(def) === 1 ? 'passage' : 'passages'} · {exported(def)}
							</p>
						</div>
						<button type="button" class={quiet} onclick={() => (deleting = def)}>
							Delete<span class="sr-only"> {def.name}</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<section aria-labelledby="new-heading">
		<h2 id="new-heading" class="text-xl font-semibold">New deck</h2>
		<form
			class="mt-3 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
			onsubmit={(e) => {
				e.preventDefault();
				create(name);
			}}
		>
			<div>
				<label for="new-name" class={label}>Name</label>
				<input
					id="new-name"
					class="{field} mt-1"
					bind:value={name}
					placeholder="Memory verses"
					autocomplete="off"
				/>
			</div>
			<div>
				<label for="new-translation" class={label}>Translation</label>
				<div class="mt-1"><TranslationSelect id="new-translation" bind:value={translation} /></div>
			</div>
			<button type="submit" class="{primary} h-10.5" disabled={!ready}>Create deck</button>
		</form>
	</section>

	<section aria-labelledby="examples-heading">
		<h2 id="examples-heading" class="text-xl font-semibold">Start from an example</h2>
		<p class="mt-2 {muted}">
			These are the Old and New Testament verses on the <a
				class={link}
				href="https://billygrahamlibrary.org/decision-card/"
				target="_blank">decision card Billy Graham was given when he came to faith.</a
			> The translation chosen above is used.
		</p>
		<div class="mt-3 flex flex-wrap gap-2">
			<button
				type="button"
				class={button}
				disabled={!ready}
				onclick={() => create('Old Testament Memory Verses', ot)}
			>
				Old Testament verses
			</button>
			<button
				type="button"
				class={button}
				disabled={!ready}
				onclick={() => create('New Testament Memory Verses', nt)}
			>
				New Testament verses
			</button>
		</div>
	</section>

	<section aria-labelledby="file-heading">
		<h2 id="file-heading" class="text-xl font-semibold">Open a deck file</h2>
		<p class="mt-2 {muted}">A deck file (.json) is what “Download deck file” saves when sharing.</p>
		<label
			class="{button} mt-3 cursor-pointer focus-within:outline-2 focus-within:outline-amber-600"
		>
			Choose a file…
			<input
				type="file"
				accept=".json,application/json"
				class="sr-only"
				disabled={!ready}
				onchange={openFile}
			/>
		</label>
		{#if fileError}<p role="alert" class="mt-2 text-sm text-red-700 dark:text-red-400">
				{fileError}
			</p>{/if}
	</section>
</main>

<ConfirmDialog
	bind:open={() => deleting !== null, (open) => !open && (deleting = null)}
	title="Delete “{deleting?.name}”?"
	description="This removes the deck from this browser. Cards you already have in Anki stay there."
	confirm="Delete"
	destructive
	onconfirm={() => {
		if (deleting) deleteDeck(deleting.id);
		decks = listDecks();
	}}
/>
