import { test, expect } from '@playwright/test';

test('dashboard loads shell and tabs', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('text=ROXEY_PRO_EDITION')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('text=Intel')).toBeVisible();
});
