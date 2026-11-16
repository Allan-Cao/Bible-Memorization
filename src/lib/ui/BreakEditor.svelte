<script lang="ts">
	import { ToggleGroup } from 'bits-ui';
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
	/** The gaps that hold a break, as the toggle group's value. */
	const pressed = $derived(item.breaks.map((b) => String(b.after)));

	/** The group reports its whole new value; the one gap that differs is the one to toggle. */
	function toggle(next: string[]) {
		const changed =
			next.find((gap) => !pressed.includes(gap)) ?? pressed.find((gap) => !next.includes(gap));
		if (changed !== undefined) onchange(toggleBreak(item.verse, item.breaks, Number(changed)));
	}
	const label = $derived(verseLabel(item.verse.ref));
</script>

<div
	class="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30"
>
	<p class="text-sm text-amber-950 dark:text-amber-100">
		Click between two words to split {label} there. Click a break to remove it. With the keyboard, the
		arrow keys move between words.
	</p>
	<!-- One tab stop for the whole verse: the group moves focus between gaps with the arrow keys. -->
	<ToggleGroup.Root
		type="multiple"
		aria-label="Breaks in {label}"
		class="mt-3 flex flex-wrap items-center font-serif text-lg leading-loose"
		bind:value={() => pressed, toggle}
	>
		{#each words as word, i (i)}
			<span>{word}</span>
			{#if i < words.length - 1}
				<ToggleGroup.Item
					value={String(i)}
					aria-label={at.has(i) ? `Remove the break after “${word}”` : `Break after “${word}”`}
					class="group mx-px inline-flex h-8 w-3 cursor-pointer items-center justify-center rounded {focus}"
				>
					<span
						class={[
							'block rounded-full',
							at.has(i)
								? 'h-7 w-1 bg-amber-600 group-hover:bg-red-600 dark:bg-amber-400'
								: 'h-4 w-px bg-stone-300 group-hover:h-6 group-hover:w-0.5 group-hover:bg-amber-500 dark:bg-stone-600'
						]}
					></span>
				</ToggleGroup.Item>
			{/if}
		{/each}
	</ToggleGroup.Root>
	<div class="mt-3 flex flex-wrap items-center justify-end gap-2">
		{#if item.saved}
			<button type="button" class={button} onclick={() => onchange(undefined)}>
				Reset to automatic
			</button>
		{/if}
		<button type="button" class={button} onclick={ondone}>Done</button>
	</div>
</div>
