<script lang="ts">
	import { button, focus } from './styles.ts';

	let { value, label }: { value: string; label: string } = $props();
	let copied = $state(false);
	let failed = $state(false);

	async function copy() {
		try {
			await navigator.clipboard.writeText(value);
			[copied, failed] = [true, false];
			setTimeout(() => (copied = false), 2000);
		} catch {
			failed = true;
		}
	}
</script>

<div class="flex items-start gap-2">
	<!-- A read-only text box rather than an input: long values wrap and scroll. -->
	<div
		role="textbox"
		aria-readonly="true"
		aria-label={label}
		tabindex="0"
		class="{focus} max-h-24 min-w-0 flex-1 overflow-y-auto rounded-md border border-stone-300 bg-stone-50 px-3 py-2 font-mono text-sm break-all select-all dark:border-stone-700 dark:bg-stone-950"
	>
		{value}
	</div>
	<button type="button" class="{button} shrink-0" onclick={copy}>
		{copied ? 'Copied' : 'Copy'}
	</button>
</div>
{#if failed}
	<p class="mt-1 text-sm">Copying did not work here. Select the text above and copy it by hand.</p>
{/if}
