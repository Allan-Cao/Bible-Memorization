import { expect, test, type Page } from '@playwright/test';

async function newDeck(page: Page, list: string) {
	await page.goto('/');
	await page.getByLabel('Name').fill('Editor deck');
	await page.getByRole('button', { name: 'Create deck' }).click();
	await page.getByLabel('Passages').fill(list);
}

test('the break editor is one tab stop, moved through with the arrow keys', async ({ page }) => {
	await newDeck(page, 'John 3:16');
	await expect(page.getByText('1 passage · 1 verse · 1 card')).toBeVisible();
	const adjust = page.getByRole('button', { name: 'Adjust breaks' });
	await adjust.click();

	const gaps = page.getByRole('group', { name: 'Breaks in John 3:16' }).getByRole('button');
	await gaps.first().focus();
	await expect(page.getByRole('button', { name: 'Break after “For”' })).toBeFocused();
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('ArrowRight');
	await expect(page.getByRole('button', { name: 'Break after “loved”' })).toBeFocused();
	await page.keyboard.press('Enter');
	await expect(page.getByText('1 passage · 1 verse · 2 cards')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Remove the break after “loved”' })).toBeFocused();

	// One Tab leaves the verse, however many words it has.
	await page.keyboard.press('Tab');
	await expect(page.getByRole('button', { name: 'Reset to automatic' })).toBeFocused();
	await page.keyboard.press('Enter');
	await expect(page.getByText('1 passage · 1 verse · 1 card')).toBeVisible();
});

test('passages stay open or closed when another is added above them', async ({ page }) => {
	await newDeck(page, 'Psalm 23:1\nPsalm 23:2\nPsalm 23:3\nPsalm 23:4');
	await expect(page.getByText('4 passages · 4 verses · 4 cards')).toBeVisible();
	const panel = (label: string) => page.getByRole('button', { name: `${label} 1 card` });
	const open = (label: string) => expect(panel(label)).toHaveAttribute('aria-expanded', 'true');
	const closed = (label: string) => expect(panel(label)).toHaveAttribute('aria-expanded', 'false');

	// The first three start open. Close the first and open the last.
	await open('Psalm 23:3');
	await closed('Psalm 23:4');
	await panel('Psalm 23:1').click();
	await panel('Psalm 23:4').click();

	await page
		.getByLabel('Passages')
		.fill('John 3:16\nPsalm 23:1\nPsalm 23:2\nPsalm 23:3\nPsalm 23:4');
	await expect(page.getByText('5 passages · 5 verses · 5 cards')).toBeVisible();
	await open('John 3:16'); // the passage just added
	await closed('Psalm 23:1');
	await open('Psalm 23:2');
	await open('Psalm 23:3');
	await open('Psalm 23:4');

	// One added at the end of the list opens too.
	await page
		.getByLabel('Passages')
		.fill('John 3:16\nPsalm 23:1\nPsalm 23:2\nPsalm 23:3\nPsalm 23:4\nPsalm 23:5');
	await open('Psalm 23:5');
	await closed('Psalm 23:1');
});

test('passages stay open or closed when a heading is added among them', async ({ page }) => {
	await newDeck(page, 'Psalm 23:1\nPsalm 23:2\nPsalm 23:3\nPsalm 23:4');
	await expect(page.getByText('4 passages · 4 verses · 4 cards')).toBeVisible();
	const panel = (label: string) => page.getByRole('button', { name: `${label} 1 card` });
	const open = (label: string) => expect(panel(label)).toHaveAttribute('aria-expanded', 'true');
	const closed = (label: string) => expect(panel(label)).toHaveAttribute('aria-expanded', 'false');

	// The first three start open. Close the third and open the last.
	await panel('Psalm 23:3').click();
	await panel('Psalm 23:4').click();
	await closed('Psalm 23:3');
	await open('Psalm 23:4');

	await page.getByLabel('Passages').fill('Psalm 23:1\nPsalm 23:2\n# Later\nPsalm 23:3\nPsalm 23:4');
	await expect(page.getByRole('heading', { name: 'Later' })).toBeVisible();
	await open('Psalm 23:1');
	await open('Psalm 23:2');
	await closed('Psalm 23:3');
	await open('Psalm 23:4');
});

test('the export button waits until an export has finished', async ({ page }) => {
	await newDeck(page, 'John 3:16');
	await expect(page.getByText('1 passage · 1 verse · 1 card')).toBeVisible();
	// Hold back the database code, which the first export fetches, to keep the export running.
	let release = () => {};
	const held = new Promise<void>((resolve) => (release = resolve));
	await page.route('**/*.wasm', async (route) => {
		await held;
		await route.continue();
	});

	const button = page.getByRole('button', { name: 'Export for Anki' });
	await button.click();
	const dialog = page.getByRole('dialog');
	await expect(dialog.getByText('Making your deck…')).toBeVisible();
	await dialog.getByRole('button', { name: 'Close' }).click();
	await expect(button).toBeDisabled();

	const download = page.waitForEvent('download');
	release();
	await download;
	await expect(button).toBeEnabled();
});

test('a deck open in two tabs follows the changes made in the other', async ({ page }) => {
	await newDeck(page, 'John 3:16');
	await expect(page.getByText('1 passage · 1 verse · 1 card')).toBeVisible();
	const other = await page.context().newPage();
	await other.goto(page.url());
	await expect(other.getByText('1 passage · 1 verse · 1 card')).toBeVisible();

	// A change in one tab shows in the other and is not undone by its next change.
	await other.getByLabel('Name').fill('Renamed');
	await other.getByLabel('Name').pressSequentially(' elsewhere', { delay: 50 }); // spaces are not trimmed away
	await expect(page.getByLabel('Name')).toHaveValue('Renamed elsewhere');
	await expect(other.getByLabel('Name')).toHaveValue('Renamed elsewhere');
	await page.getByLabel('Passages').fill('John 3:16\nJohn 3:17');
	await expect(other.getByText('2 passages · 2 verses · 2 cards')).toBeVisible();
	await expect(other.getByLabel('Name')).toHaveValue('Renamed elsewhere');

	// Each export takes a new revision, whichever tab it is made in.
	const id = page.url().split('/').pop();
	const revision = () =>
		page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).revision, `bm.deck.${id}`);
	for (const tab of [other, page]) {
		const download = tab.waitForEvent('download');
		await tab.getByRole('button', { name: 'Export for Anki' }).click();
		await download;
		await tab.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
	}
	expect(await revision()).toBe(2);

	// A deck deleted in one tab is not saved again by the other, which goes back to the list.
	await other.goto('/');
	await other.getByRole('button', { name: 'Delete Renamed elsewhere' }).click();
	await other.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
	await expect(page).toHaveURL(/\/$/);
	await expect(page.getByText('You have no decks yet.')).toBeVisible();
});

test('a deck the browser will not store comes with a warning', async ({ page }) => {
	await page.addInitScript(() => {
		Storage.prototype.setItem = () => {
			throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
		};
	});
	await newDeck(page, 'John 3:16');
	await expect(page.getByText('1 passage · 1 verse · 1 card')).toBeVisible();
	await expect(page.getByText('This browser did not let the page save this deck')).toBeVisible();
});

test('a deck page loads directly, and an unknown address says so', async ({ page }) => {
	await newDeck(page, 'John 3:16');
	await expect(page.getByText('1 passage · 1 verse · 1 card')).toBeVisible();
	await page.reload();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Editor deck');
	await expect(page.getByText('1 passage · 1 verse · 1 card')).toBeVisible();
	await expect(page).toHaveTitle('Editor deck · Bible Memorization');
	await page.getByLabel('Name').fill('Renamed deck');
	await expect(page).toHaveTitle('Renamed deck · Bible Memorization');

	const response = await page.goto('/no-such-page');
	expect(response?.status()).toBe(404);
	await expect(page.getByText('Not Found')).toBeVisible();
});
