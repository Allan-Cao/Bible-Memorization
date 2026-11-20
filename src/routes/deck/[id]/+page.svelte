<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import DeckEditor from '#lib/ui/DeckEditor.svelte';
	import { loadDeck } from '#lib/ui/storage.ts';
	import { link, muted } from '#lib/ui/styles.ts';

	const def = $derived(loadDeck(page.params.id ?? ''));
</script>

<!-- The editor sets the title from the deck name as it is edited. -->
<svelte:head>
	{#if !def}<title>manna.cards</title>{/if}
</svelte:head>

{#if def}
	{#key def.id}
		<DeckEditor initial={def} />
	{/key}
{:else}
	<main class="mx-auto max-w-2xl px-4 py-10">
		<h1 class="font-serif text-2xl font-semibold">Deck not found</h1>
		<p class="mt-3 {muted}">
			This deck is not saved in this browser. Decks are kept only on the device where they were
			made; to move one, share it from there.
		</p>
		<p class="mt-3"><a class={link} href={resolve('/')}>Back to your decks</a></p>
	</main>
{/if}
