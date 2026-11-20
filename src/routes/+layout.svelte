<script lang="ts">
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import { resolve } from '$app/paths';
	import { focus, link } from '#lib/ui/styles.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>manna.cards</title>
</svelte:head>

<div class="flex min-h-screen flex-col">
	<header class="border-b border-stone-200 dark:border-stone-800">
		<nav
			class="mx-auto flex max-w-6xl items-baseline justify-between gap-4 px-4 py-3"
			aria-label="Main"
		>
			<a
				href={resolve('/')}
				class="rounded font-serif text-lg font-semibold tracking-tight {focus}"
			>
				manna.cards
			</a>
			<a href={resolve('/about')} class="text-sm {link}">About</a>
		</nav>
	</header>
	<div class="flex-1">
		{@render children()}
	</div>
</div>
