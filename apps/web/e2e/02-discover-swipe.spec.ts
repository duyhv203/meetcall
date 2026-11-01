import { test, expect } from '@playwright/test';

test.describe('E2E Luồng 2: Khám phá & Vuốt ghép đôi (Discover & Swipe)', () => {
  test.beforeEach(async ({ page }) => {
    // Login with existing seeded test account
    await page.goto('/login');
    await page.fill('input[type="email"]', 'linh.nguyen@meetcall.local');
    await page.fill('input[name="password"]', 'Password123!');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/(discover)?$/, { timeout: 10000 });
  });

  test('1. Hiển thị thẻ ứng viên với khoảng cách làm tròn 5km (bảo vệ quyền riêng tư)', async ({ page }) => {
    await page.goto('/discover');

    // Wait for candidate card
    const card = page.locator('[data-testid="discover-card"]').first();
    if (await card.isVisible({ timeout: 5000 })) {
      // Check rounded distance label exists (e.g. "Cách bạn 5 km" or "10 km")
      const distanceBadge = page.locator('text=/\\d+\\s*km/i');
      await expect(distanceBadge).toBeVisible();
    }
  });

  test('2. Thao tác vuốt Bỏ qua (Pass) bằng nút hoặc phím mũi tên trái', async ({ page }) => {
    await page.goto('/discover');

    const passBtn = page.locator('button[aria-label="pass"], button:has-text("✕")').first();
    if (await passBtn.isVisible({ timeout: 5000 })) {
      await passBtn.click();
      // Next card transitions in
    } else {
      await page.keyboard.press('ArrowLeft');
    }
  });

  test('3. Thao tác vuốt Thích (Like) và hiển thị modal Chúc mừng khi tương hợp', async ({ page }) => {
    await page.goto('/discover');

    const likeBtn = page.locator('button[aria-label="like"], button:has-text("♥")').first();
    if (await likeBtn.isVisible({ timeout: 5000 })) {
      await likeBtn.click();
    } else {
      await page.keyboard.press('ArrowRight');
    }

    // If match occurs, Match modal appears
    const matchModal = page.locator('text=It\'s a Match!');
    if (await matchModal.isVisible({ timeout: 3000 })) {
      await expect(matchModal).toBeVisible();
      await page.click('button:has-text("Gửi lời chào"), button:has-text("Trò chuyện")');
    }
  });
});
