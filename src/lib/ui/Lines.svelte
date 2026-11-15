<script lang="ts">
	import type { Line } from '#lib/core/model.ts';

	let { lines, verseNumber }: { lines: Line[]; verseNumber?: number } = $props();

	const indent = ['pl-0', 'pl-6', 'pl-12', 'pl-18'];
</script>

{#each lines as line, i (i)}
	<div
		class={[
			indent[line.indent],
			line.paragraph && i > 0 && 'mt-3',
			line.selah && 'text-sm text-stone-500 italic'
		]}
	>
		{#if i === 0 && verseNumber !== undefined}
			<sup class="mr-0.5 font-sans text-[0.65em] font-semibold text-stone-500">{verseNumber}</sup
			>{/if}{line.text}
	</div>
{/each}
