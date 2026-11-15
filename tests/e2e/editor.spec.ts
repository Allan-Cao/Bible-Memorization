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

test('a deck page loads directly, and an unknown address says so', async ({ page }) => {
	await newDeck(page, 'John 3:16');
	await expect(page.getByText('1 passage · 1 verse · 1 card')).toBeVisible();
	await page.reload();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Editor deck');
	await expect(page.getByText('1 passage · 1 verse · 1 card')).toBeVisible();

	const response = await page.goto('/no-such-page');
	expect(response?.status()).toBe(404);
	await expect(page.getByText('Not Found')).toBeVisible();
});
