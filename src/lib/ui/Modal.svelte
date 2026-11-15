<script lang="ts">
	import { Dialog } from 'bits-ui';
	import type { Snippet } from 'svelte';
	import { button } from './styles.ts';

	let {
		open = $bindable(false),
		title,
		children
	}: { open: boolean; title: string; children: Snippet } = $props();
</script>

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-40 bg-stone-950/60" />
		<Dialog.Content
			class="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl bg-white p-6 shadow-xl dark:border dark:border-stone-700 dark:bg-stone-900"
		>
			<Dialog.Title class="text-lg font-semibold">{title}</Dialog.Title>
			<div class="mt-3 space-y-4 leading-relaxed text-stone-700 dark:text-stone-300">
				{@render children()}
			</div>
			<div class="mt-6 flex justify-end">
				<Dialog.Close class={button}>Close</Dialog.Close>
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
