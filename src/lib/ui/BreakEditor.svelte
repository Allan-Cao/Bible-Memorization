<script lang="ts">
	import { toggleBreak, type PreviewVerse } from '#lib/core/editor.ts';
	import type { Break } from '#lib/core/model.ts';
	import { verseLabel } from '#lib/core/refs.ts';
	import { verseWords } from '#lib/core/units.ts';
	import { button, focus } from './styles.ts';

	let {
		item,
		onchange,
		ondone
	}: {
		item: PreviewVerse;
		/** `undefined` returns the verse to automatic breaks. */
		onchange: (breaks: Break[] | undefined) => void;
		ondone: () => void;
	} = $props();

	const words = $derived(verseWords(item.verse));
	const at = $derived(new Set(item.breaks.map((b) => b.after)));
	const label = $derived(verseLabel(item.verse.ref));
</script>

<div
	role="group"
	aria-label="Breaks in {label}"
	class="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30"
>
	<p class="text-sm text-amber-950 dark:text-amber-100">
		Click between two words to split {label} there. Click a break to remove it.
	</p>
	<p class="mt-3 flex flex-wrap items-center font-serif text-lg leading-loose">
		{#each words as word, i (i)}
			<span>{word}</span>
			{#if i < words.length - 1}
				<button
					type="button"
					aria-pressed={at.has(i)}
					aria-label={at.has(i) ? `Remove the break after “${word}”` : `Break after “${word}”`}
					class="group mx-px inline-flex h-8 w-3 cursor-pointer items-center justify-center rounded {focus}"
					onclick={() => onchange(toggleBreak(item.verse, item.breaks, i))}
				>
					<span
						class={[
							'block rounded-full',
							at.has(i)
								? 'h-7 w-1 bg-amber-600 group-hover:bg-red-600 dark:bg-amber-400'
								: 'h-4 w-px bg-stone-300 group-hover:h-6 group-hover:w-0.5 group-hover:bg-amber-500 dark:bg-stone-600'
						]}
					></span>
				</button>
			{/if}
		{/each}
	</p>
	<div class="mt-3 flex flex-wrap items-center justify-end gap-2">
		{#if item.saved}
			<button type="button" class={button} onclick={() => onchange(undefined)}>
				Reset to automatic
			</button>
		{/if}
		<button type="button" class={button} onclick={ondone}>Done</button>
	</div>
</div>
