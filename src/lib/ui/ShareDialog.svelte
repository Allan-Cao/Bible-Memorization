<script lang="ts">
	import { resolve } from '$app/paths';
	import { encodeShare } from '#lib/core/deckdef.ts';
	import type { DeckDefinition } from '#lib/core/model.ts';
	import { downloadFile, fileName } from './browser.ts';
	import CopyField from './CopyField.svelte';
	import Modal from './Modal.svelte';
	import { button } from './styles.ts';

	let { open = $bindable(false), def }: { open: boolean; def: DeckDefinition } = $props();

	let url = $state('');
	$effect(() => {
		if (!open) return;
		const snapshot = $state.snapshot(def);
		encodeShare(snapshot).then(
			(text) => (url = new URL(resolve(`/open#${text}`), location.href).href)
		);
	});
</script>

<Modal bind:open title="Share this deck">
	<p>
		Anyone with this link gets a copy of the deck and can make their own Anki file. If you change
		the deck later, send them a new link and they can update theirs.
	</p>
	{#if url}<CopyField value={url} label="Link to this deck" />{/if}
	<button
		type="button"
		class={button}
		onclick={() =>
			downloadFile(
				fileName(def.name, 'json'),
				JSON.stringify($state.snapshot(def), null, '\t'),
				'application/json'
			)}
	>
		Download deck file
	</button>
</Modal>
