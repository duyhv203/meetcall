import { test, expect } from '@playwright/test';

test.describe('E2E Luồng 4: Cuộc gọi Video 1-1 qua WebRTC', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'linh.nguyen@meetcall.local');
    await page.fill('input[name="password"]', 'Password123!');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/(discover)?$/, { timeout: 10000 });
  });

  test('1. Bắt đầu cuộc gọi video từ thanh tiêu đề phòng chat', async ({ page }) => {
    await page.goto('/matches');
    const firstMatch = page.locator('[data-testid="match-item"]').first();
    if (await firstMatch.isVisible({ timeout: 5000 })) {
      await firstMatch.click();

      // Click video call button in header
      const callBtn = page.locator('button:has-text("📹"), button[aria-label="video-call"]').first();
      if (await callBtn.isVisible({ timeout: 5000 })) {
        await callBtn.click();

        // Redirect to CallPage
        await expect(page).toHaveURL(/.*\/call.*/, { timeout: 10000 });

        // Local video track should be rendered
        const localVideo = page.locator('video').first();
        await expect(localVideo).toBeVisible();

        // Hangup call
        const endCallBtn = page.locator('button:has-text("Kết thúc"), button[aria-label="end-call"]').first();
        if (await endCallBtn.isVisible()) {
          await endCallBtn.click();
        }
      }
    }
  });
});
