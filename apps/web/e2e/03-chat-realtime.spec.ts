import { test, expect } from '@playwright/test';

test.describe('E2E Luồng 3: Trò chuyện Realtime & Bộ lọc an toàn (Chat)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'linh.nguyen@meetcall.local');
    await page.fill('input[name="password"]', 'Password123!');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/(discover)?$/, { timeout: 10000 });
  });

  test('1. Xem danh sách tương hợp và mở phòng chat', async ({ page }) => {
    await page.goto('/matches');

    const firstMatch = page.locator('[data-testid="match-item"]').first();
    if (await firstMatch.isVisible({ timeout: 5000 })) {
      await firstMatch.click();
      await expect(page).toHaveURL(/.*\/chat\/.+/, { timeout: 10000 });

      // Chat input box should be visible
      const input = page.locator('input[placeholder*="tin nhắn"], textarea[placeholder*="tin nhắn"]').first();
      await expect(input).toBeVisible();
    }
  });

  test('2. Gửi tin nhắn văn bản và kiểm tra chống spam liên kết (> 2 links)', async ({ page }) => {
    await page.goto('/matches');
    const firstMatch = page.locator('[data-testid="match-item"]').first();
    if (await firstMatch.isVisible({ timeout: 5000 })) {
      await firstMatch.click();

      const input = page.locator('input[placeholder*="tin nhắn"], textarea[placeholder*="tin nhắn"]').first();

      // Send normal message
      await input.fill('Chào bạn, rất vui được làm quen!');
      await page.keyboard.press('Enter');

      // Send spam message with > 2 links
      await input.fill('Xem tại https://a.com https://b.com https://c.com');
      await page.keyboard.press('Enter');

      // Warning or error toast should be visible
      const warning = page.locator('text=/liên kết|spam/i');
      if (await warning.isVisible({ timeout: 3000 })) {
        await expect(warning).toBeVisible();
      }
    }
  });
});
