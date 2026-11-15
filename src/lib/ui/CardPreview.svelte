<script lang="ts">
	import { Toggle } from 'bits-ui';
	import type { Snippet } from 'svelte';
	import type { PreviewCard } from '#lib/core/editor.ts';
	import Lines from './Lines.svelte';
	import { quiet } from './styles.ts';

	let { card, actions }: { card: PreviewCard; actions?: Snippet } = $props();
	let hint = $state(false);
</script>

<article
	class="rounded-lg border border-stone-200 bg-white px-4 py-3 dark:border-stone-800 dark:bg-stone-900"
>
	<div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
		<p class="text-sm font-semibold">{card.reference}</p>
		<div class="flex gap-1">
			<Toggle.Root bind:pressed={hint} class={quiet}>Hint</Toggle.Root>
			{@render actions?.()}
		</div>
	</div>
	{#if card.lead}
		<div
			class={[
				'mt-2 font-serif leading-relaxed text-stone-500 dark:text-stone-400',
				card.lead.title && 'text-sm italic'
			]}
		>
			<Lines lines={card.lead.lines} verseNumber={card.lead.verseNumber} />
		</div>
	{/if}
	<div
		class={[
			'font-serif text-lg leading-relaxed',
			card.lead ? 'mt-3 border-t border-dashed border-stone-200 pt-3 dark:border-stone-700' : 'mt-2'
		]}
	>
		{#if hint}
			<span class="sr-only">First letters:</span>
			<Lines lines={card.hint} />
		{:else}
			<Lines lines={card.unit.lines} verseNumber={card.verseNumber} />
		{/if}
	</div>
</article>
