/** Shared Tailwind class lists, so buttons and fields look the same everywhere. */

export const focus =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600';

export const button = `inline-flex items-center justify-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-800 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:hover:bg-stone-800 ${focus}`;

export const primary = `inline-flex items-center justify-center gap-2 rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-300 ${focus}`;

export const danger = `inline-flex items-center justify-center gap-2 rounded-md bg-red-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-800 ${focus}`;

/** Small borderless button, for actions inside cards. */
export const quiet = `rounded px-1.5 py-0.5 text-xs font-medium text-stone-600 hover:bg-stone-100 hover:text-stone-900 data-[state=on]:bg-amber-100 data-[state=on]:text-amber-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100 dark:data-[state=on]:bg-amber-900/50 dark:data-[state=on]:text-amber-100 ${focus}`;

export const field = `w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-base text-stone-900 placeholder:text-stone-400 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 ${focus}`;

export const label = 'block text-sm font-medium text-stone-700 dark:text-stone-300';

export const link = `underline decoration-stone-400 underline-offset-2 hover:decoration-stone-900 dark:hover:decoration-stone-100 ${focus}`;

export const muted = 'text-stone-600 dark:text-stone-400';

export const notice =
	'rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100';
