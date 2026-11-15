<script lang="ts">
	import { Collapsible, Toggle } from 'bits-ui';
	import type { PreviewPassage } from '#lib/core/editor.ts';
	import type { Break } from '#lib/core/model.ts';
	import { verseLabel } from '#lib/core/refs.ts';
	import BreakEditor from './BreakEditor.svelte';
	import CardPreview from './CardPreview.svelte';
	import { focus, muted, quiet } from './styles.ts';

	let {
		passage,
		open = false,
		translation,
		onbreaks
	}: {
		passage: PreviewPassage;
		/** Open at first. */
		open?: boolean;
		/** Short name, for omitted verses. */
		translation: string;
		onbreaks: (key: string, breaks: Break[] | undefined) => void;
	} = $props();

	/** Key of the verse whose breaks are being adjusted. */
	let editing = $state<string | null>(null);
</script>

<Collapsible.Root bind:open>
	<h4>
		<Collapsible.Trigger
			class="group flex w-full items-baseline justify-between gap-3 rounded-md px-2 py-2 text-left hover:bg-stone-100 dark:hover:bg-stone-900 {focus}"
		>
			<span class="flex items-baseline gap-2 font-medium">
				<span
					aria-hidden="true"
					class="inline-block w-3 text-stone-500 transition-transform group-data-[state=open]:rotate-90"
					>▸</span
				>
				{passage.label}
			</span>
			<span class="shrink-0 text-sm {muted}">
				{passage.cards}
				{passage.cards === 1 ? 'card' : 'cards'}
			</span>
		</Collapsible.Trigger>
	</h4>
	<Collapsible.Content class="space-y-3 pt-2 pb-4 sm:pl-5">
		{#each passage.verses as item (item.key)}
			{#if item.verse.omitted}
				<p class="text-sm {muted}">
					{verseLabel(item.verse.ref)} is not in the {translation}, so it has no card.
				</p>
			{:else if item.repeated}
				<p class="text-sm {muted}">
					{verseLabel(item.verse.ref)} is already asked earlier in the deck.
				</p>
			{:else}
				{#if editing === item.key}
					<BreakEditor
						{item}
						onchange={(breaks) => onbreaks(item.key, breaks)}
						ondone={() => (editing = null)}
					/>
				{/if}
				{#each item.cards as card, i (card.unit.index)}
					<CardPreview {card}>
						{#snippet actions()}
							{#if i === 0}
								<Toggle.Root
									class={quiet}
									bind:pressed={
										() => editing === item.key, (on) => (editing = on ? item.key : null)
									}
								>
									Adjust breaks
								</Toggle.Root>
							{/if}
						{/snippet}
					</CardPreview>
				{/each}
			{/if}
		{/each}
	</Collapsible.Content>
</Collapsible.Root>
