<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { decodeShare } from '#lib/core/deckdef.ts';
	import { passageCount } from '#lib/core/editor.ts';
	import type { DeckDefinition } from '#lib/core/model.ts';
	import { TRANSLATIONS } from '#lib/core/translations.ts';
	import { loadDeck, saveDeck } from '#lib/ui/storage.ts';
	import { button, link, muted, primary } from '#lib/ui/styles.ts';

	let incoming = $state<DeckDefinition | null>(null);
	let mine = $state<DeckDefinition | null>(null);
	let error = $state('');

	onMount(async () => {
		try {
			incoming = await decodeShare(location.hash.slice(1));
			mine = loadDeck(incoming.id);
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	});

	function open(def: DeckDefinition) {
		goto(resolve('/deck/[id]', { id: def.id }), { replace: true });
	}

	function add(def: DeckDefinition) {
		saveDeck({ ...def, revision: Math.max(def.revision, mine?.revision ?? 0) });
		open(def);
	}

	function describe(def: DeckDefinition): string {
		const n = passageCount(def);
		return `${TRANSLATIONS[def.translation].short}, ${n} ${n === 1 ? 'passage' : 'passages'}`;
	}
</script>

<svelte:head><title>Open a shared deck · manna.cards</title></svelte:head>

<main class="mx-auto max-w-2xl px-4 py-10">
	<h1 class="font-serif text-2xl font-semibold tracking-tight">Open a shared deck</h1>
	{#if error}
		<p role="alert" class="mt-4 text-red-700 dark:text-red-400">{error}</p>
		<p class="mt-3 {muted}">
			Ask the person who sent it for a new link, or copy the whole link again.
		</p>
		<p class="mt-3"><a class={link} href={resolve('/')}>Go to your decks</a></p>
	{:else if incoming && mine}
		<p class="mt-4 leading-relaxed">
			You already have this deck as <strong>“{mine.name}”</strong>
			({describe(mine)}). The link has <strong>“{incoming.name}”</strong> ({describe(incoming)}).
		</p>
		<p class="mt-2 {muted}">
			Updating replaces your list and breaks with the ones in the link. After that, export it again
			to update your cards in Anki.
		</p>
		<div class="mt-5 flex flex-wrap gap-2">
			<button type="button" class={primary} onclick={() => incoming && add(incoming)}>
				Update my copy
			</button>
			<button type="button" class={button} onclick={() => mine && open(mine)}>Keep mine</button>
		</div>
	{:else if incoming}
		<p class="mt-4 leading-relaxed">
			Someone shared <strong>“{incoming.name}”</strong> ({describe(incoming)}) with you.
		</p>
		<div class="mt-5">
			<button type="button" class={primary} onclick={() => incoming && add(incoming)}>
				Add this deck
			</button>
		</div>
	{:else}
		<p class="mt-4 {muted}">Reading the link…</p>
	{/if}
</main>
