import { expect, test } from '@playwright/test';
import { unzipSync } from 'fflate';
import { readFile } from 'node:fs/promises';
import type { Download, Page } from '@playwright/test';

async function exportDeck(page: Page): Promise<Uint8Array> {
	const download: Promise<Download> = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Export for Anki' }).click();
	const file = await download;
	expect(file.suggestedFilename()).toBe('Smoke deck.apkg');
	return new Uint8Array(await readFile((await file.path())!));
}

test('make, fix, export, update and share a deck', async ({ page, browser, browserName }) => {
	await page.goto('/');
	await page.getByLabel('Name').fill('Smoke deck');
	await page.getByRole('button', { name: 'Create deck' }).click();
	await expect(page).toHaveURL(/\/deck\/[a-z0-9]+$/);

	// An invalid line is reported with its line number and blocks the export.
	const list = page.getByLabel('Passages');
	await list.fill('Psalm 23\nJohn 3:16-17\nJohn 99:1');
	await expect(page.getByText('Line 3:')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Export for Anki' })).toBeDisabled();

	await list.fill('Psalm 23\nJohn 3:16-17');
	await expect(page.getByText('2 passages · 8 verses · 8 cards')).toBeVisible();
	await expect(page.getByText('Line 3:')).toHaveCount(0);

	// A manual break splits John 3:16 into two cards.
	const john = page.locator('article').filter({ hasText: 'John 3:16' }).first();
	await john.getByRole('button', { name: 'Adjust breaks' }).click();
	await page.getByRole('button', { name: 'Break after “loved”' }).click();
	await expect(page.getByText('2 passages · 8 verses · 9 cards')).toBeVisible();
	await expect(page.getByText('John 3:16 (1/2)')).toBeVisible();
	await page.getByRole('button', { name: 'Done' }).click();

	const first = await exportDeck(page);
	expect(String.fromCharCode(first[0], first[1])).toBe('PK');
	const files = unzipSync(first);
	expect(Object.keys(files).sort()).toEqual(['collection.anki2', 'media']);
	const collection = files['collection.anki2'];
	expect(collection.length).toBeGreaterThan(10_000);
	expect(new TextDecoder().decode(collection.slice(0, 15))).toBe('SQLite format 3');
	const dialog = page.getByRole('dialog');
	await expect(dialog.getByText('Your deck is downloading')).toBeVisible();
	await expect(dialog.getByText('Changes since your last export')).toHaveCount(0);
	await dialog.getByRole('button', { name: 'Close' }).click();

	// Remove Psalm 23, add Romans 8:38-39, export again.
	await list.fill('John 3:16-17\nRomans 8:38-39');
	await expect(page.getByText('2 passages · 4 verses · 5 cards')).toBeVisible();
	await exportDeck(page);
	await expect(dialog.getByText('Changes since your last export')).toBeVisible();
	await expect(dialog.getByText('Added: Romans 8:38-39')).toBeVisible();
	await expect(dialog.getByText('Removed: Psalm 23')).toBeVisible();
	await expect(dialog.getByText('2 cards added, 6 cards removed.', { exact: false })).toBeVisible();
	await expect(dialog.getByLabel('Search for the old cards')).toHaveText(
		/^tag:bm::[a-z0-9]+::\* -tag:bm::[a-z0-9]+::r2$/
	);
	await expect(dialog.getByText('Check that it finds 6 cards.')).toBeVisible();
	await dialog.getByRole('button', { name: 'Close' }).click();

	// Share link: the same browser is offered an update, a fresh one adds the deck.
	await page.getByRole('button', { name: 'Share' }).click();
	const link = page.getByLabel('Link to this deck');
	await expect(link).toHaveText(/\/open#[A-Za-z0-9_-]+$/);
	const url = (await link.textContent())!.trim();
	if (browserName === 'chromium') {
		// Only Chromium lets a test read the clipboard back.
		await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
		await page.getByRole('dialog').getByRole('button', { name: 'Copy' }).click();
		await expect(page.getByRole('dialog').getByRole('button', { name: 'Copied' })).toBeVisible();
		expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(url);
	}
	await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();

	await page.goto(url);
	await expect(page.getByRole('button', { name: 'Update my copy' })).toBeVisible();
	await page.getByRole('button', { name: 'Keep mine' }).click();
	await expect(page).toHaveURL(/\/deck\//);

	const friend = await browser.newPage();
	await friend.goto(url);
	await friend.getByRole('button', { name: 'Add this deck' }).click();
	await expect(friend.getByRole('heading', { level: 1 })).toHaveText('Smoke deck');
	await expect(friend.getByText('2 passages · 4 verses · 5 cards')).toBeVisible();

	await friend.goto('/open#not-a-deck');
	await expect(friend.getByRole('alert')).toContainText('damaged or incomplete');
});
