import { test, expect } from '@playwright/test';

test.describe('Vaultix Web Application - Registration Page Tests', () => {
  test('should load registration page and display input fields', async ({ page }) => {
    await page.goto('/register');

    const nameInput = page.locator('input[placeholder="Full name"]');
    const emailInput = page.locator('input[placeholder="Email address"]');
    const passwordInput = page.locator('input[placeholder="Password"]');
    const submitBtn = page.locator('button[type="submit"]');

    await expect(nameInput).toBeVisible();
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitBtn).toBeVisible();
  });

  test('should show validation errors when submitting invalid data', async ({ page }) => {
    await page.goto('/register');

    // Fill valid name and email, but short password to trigger React validation error
    await page.locator('input[placeholder="Full name"]').fill('Test User');
    await page.locator('input[placeholder="Email address"]').fill('test@example.com');
    await page.locator('input[placeholder="Password"]').fill('123');

    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();

    // Check error message appears for password
    const errorMsg = page.locator('.text-red-500');
    await expect(errorMsg).toBeVisible();
    await expect(errorMsg).toContainText(/Password must be at least/);
  });

  test('should navigate between Register and Login pages', async ({ page }) => {
    await page.goto('/register');

    // Click "Sign in" or login link
    const loginLink = page.locator('a[href="/login"]');
    await expect(loginLink).toBeVisible();
    await loginLink.click();

    await expect(page).toHaveURL(/.*login/);
  });
});
