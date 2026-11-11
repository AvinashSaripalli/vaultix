import { test, expect } from '@playwright/test';

test.describe('Vaultix Mobile Responsive Tests', () => {
  test.use({ viewport: { width: 390, height: 844 } }); // iPhone / Pixel mobile viewport

  test('should render mobile layout on login page without desktop side banner', async ({ page }) => {
    await page.goto('/login');

    // Desktop left hero text should not be visible on mobile
    const desktopHero = page.locator('text=Next-Generation');
    await expect(desktopHero).not.toBeVisible();

    // Mobile form container should be visible and centered
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[placeholder="Password"]');
    const loginButton = page.locator('button[type="submit"]:has-text("Login")');

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(loginButton).toBeVisible();

    // Form inputs should fit within the 390px viewport without horizontal overflow
    const box = await loginButton.boundingBox();
    expect(box).not.toBeNull();
    expect(box.width).toBeLessThanOrEqual(390);
  });
});
