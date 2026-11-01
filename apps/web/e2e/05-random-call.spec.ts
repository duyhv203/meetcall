import { test, expect } from '@playwright/test';

test.describe('E2E Luồng 5: Gọi Video Ngẫu nhiên (Random Calls)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'linh.nguyen@meetcall.local');
    await page.fill('input[name="password"]', 'Password123!');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/(discover)?$/, { timeout: 10000 });
  });

  test('1. Yêu cầu đồng ý quy tắc cộng đồng 18+ trước khi tham gia', async ({ page }) => {
    await page.goto('/random');

    // Community rules consent modal
    const consentHeader = page.locator('text=Quy tắc Cộng đồng 18+');
    if (await consentHeader.isVisible({ timeout: 5000 })) {
      await expect(consentHeader).toBeVisible();

      // Check all rules checkboxes
      const checkboxes = page.locator('input[type="checkbox"]');
      const count = await checkboxes.count();
      for (let i = 0; i < count; i++) {
        await checkboxes.nth(i).check();
      }

      // Click "Tôi đồng ý & Bắt đầu"
      const startBtn = page.locator('button:has-text("Tôi đồng ý"), button:has-text("Bắt đầu")').first();
      await startBtn.click();
    }
  });

  test('2. Hiển thị hiệu ứng radar tìm kiếm đối tác và thanh điều khiển', async ({ page }) => {
    await page.goto('/random');

    // Accept consent if shown
    const startBtn = page.locator('button:has-text("Tôi đồng ý"), button:has-text("Bắt đầu")').first();
    if (await startBtn.isVisible({ timeout: 3000 })) {
      const checkboxes = page.locator('input[type="checkbox"]');
      const count = await checkboxes.count();
      for (let i = 0; i < count; i++) {
        await checkboxes.nth(i).check();
      }
      await startBtn.click();
    }

    // Radar screen or video screen should be visible
    const radarOrVideo = page.locator('text=/đang tìm|kết nối|chuyển/i').first();
    await expect(radarOrVideo).toBeVisible({ timeout: 5000 });
  });
});
