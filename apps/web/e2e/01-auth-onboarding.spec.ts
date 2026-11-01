import { test, expect } from '@playwright/test';

test.describe('E2E Luồng 1: Xác thực & Onboarding 18+', () => {
  const timestamp = Date.now();
  const testEmail = `pw_user_${timestamp}@meetcall.local`;
  const password = 'Password123!';

  test('1. Chặn người dùng dưới 18 tuổi ngay tại giao diện đăng ký', async ({ page }) => {
    await page.goto('/register');

    // Fill under 18 birthdate (e.g. born in 2015)
    await page.fill('input[type="email"]', `underage_${timestamp}@meetcall.local`);
    await page.fill('input[name="password"]', password);
    await page.fill('input[name="confirmPassword"]', password);
    await page.fill('input[name="birthdate"]', '2015-01-01');

    await page.click('button[type="submit"]');

    // Expect error message about 18+ age restriction
    await expect(page.locator('text=18 tuổi')).toBeVisible({ timeout: 5000 });
  });

  test('2. Đăng ký tài khoản hợp lệ đủ 18 tuổi và hoàn tất Onboarding 4 bước', async ({ page }) => {
    await page.goto('/register');

    // Register with 18+ birthdate
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[name="password"]', password);
    await page.fill('input[name="confirmPassword"]', password);
    await page.fill('input[name="birthdate"]', '1998-05-15');

    await page.click('button[type="submit"]');

    // Should redirect to onboarding
    await expect(page).toHaveURL(/.*\/onboarding/, { timeout: 10000 });

    // Step 1: Profile information
    await expect(page.locator('text=Thông tin cá nhân')).toBeVisible();
    await page.fill('input[name="displayName"]', 'Ngọc Trinh');
    await page.selectOption('select[name="gender"]', 'female');
    await page.fill('textarea[name="bio"]', 'Yêu thích du lịch, âm nhạc và kết nối bạn bè.');
    await page.click('button:has-text("Tiếp tục")');

    // Step 2: Photos
    await expect(page.locator('text=Ảnh đại diện')).toBeVisible();
    // In automated test, mock or proceed to next step
    const nextBtn = page.locator('button:has-text("Tiếp tục")');
    if (await nextBtn.isVisible()) {
      await nextBtn.click();
    }

    // Step 3: Preferences
    await expect(page.locator('text=Sở thích')).toBeVisible({ timeout: 5000 });
    await page.click('button:has-text("Tiếp tục")');

    // Step 4: Location
    await expect(page.locator('text=Vị trí')).toBeVisible({ timeout: 5000 });
    await page.click('button:has-text("Hoàn tất")');

    // Should redirect to Home / Discover
    await expect(page).toHaveURL(/\/(discover)?$/, { timeout: 10000 });
  });
});
