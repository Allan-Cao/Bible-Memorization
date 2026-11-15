<script lang="ts">
	import { Select } from 'bits-ui';
	import type { TranslationId } from '#lib/core/model.ts';
	import { TRANSLATIONS } from '#lib/core/translations.ts';
	import { field, focus } from './styles.ts';

	let { value = $bindable(), id }: { value: TranslationId; id: string } = $props();

	const items = Object.values(TRANSLATIONS).map((t) => ({
		value: t.id,
		label: `${t.name} (${t.short})`
	}));
</script>

<Select.Root
	type="single"
	{items}
	bind:value={() => value, (v) => (value = v as TranslationId)}
	allowDeselect={false}
>
	<Select.Trigger {id} class="{field} flex items-center justify-between gap-2 text-left">
		<span class="truncate">{items.find((item) => item.value === value)?.label}</span>
		<span aria-hidden="true" class="text-stone-500">▾</span>
	</Select.Trigger>
	<Select.Portal>
		<Select.Content
			sideOffset={4}
			class="z-50 w-(--bits-select-anchor-width) min-w-56 rounded-md border border-stone-200 bg-white p-1 shadow-lg dark:border-stone-700 dark:bg-stone-900"
		>
			<Select.Viewport>
				{#each items as item (item.value)}
					<Select.Item
						value={item.value}
						label={item.label}
						class="flex cursor-default items-center justify-between gap-3 rounded px-3 py-2 text-sm data-highlighted:bg-stone-100 dark:data-highlighted:bg-stone-800 {focus}"
					>
						{#snippet children({ selected })}
							{item.label}
							{#if selected}<span aria-hidden="true">✓</span>{/if}
						{/snippet}
					</Select.Item>
				{/each}
			</Select.Viewport>
		</Select.Content>
	</Select.Portal>
</Select.Root>
