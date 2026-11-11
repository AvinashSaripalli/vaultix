import { test, expect } from '@playwright/test';

test.describe('Vaultix Web Application - Smoke & Login Tests', () => {
  test('should load page with correct title and redirect to login', async ({ page }) => {
    await page.goto('/');

    // Check document title
    await expect(page).toHaveTitle(/Vaultix/);

    // Unauthenticated user should be redirected to /login
    await expect(page).toHaveURL(/.*login/);
  });

  test('should display login form elements correctly', async ({ page }) => {
    await page.goto('/login');

    // Email input, Password input, and Login button
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[placeholder="Password"]');
    const loginButton = page.locator('button[type="submit"]:has-text("Login")');

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(loginButton).toBeVisible();
  });

  test('should validate empty credentials on login submission', async ({ page }) => {
    await page.goto('/login');

    const loginButton = page.locator('button[type="submit"]:has-text("Login")');
    await loginButton.click();

    // Check for inline validation errors
    const errorText = page.locator('.text-red-500');
    await expect(errorText.first()).toBeVisible();
  });

  test('should toggle password visibility when clicking eye button', async ({ page }) => {
    await page.goto('/login');

    const passwordInput = page.locator('input[placeholder="Password"]');
    await passwordInput.fill('SecretPassword123');

    // Initially type is password
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Click the toggle button inside the password container
    const toggleButton = passwordInput.locator('xpath=following-sibling::button');
    await toggleButton.click();

    // Now type should be text
    await expect(passwordInput).toHaveAttribute('type', 'text');

    // Click again to hide
    await toggleButton.click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('should navigate to Forgot Password page', async ({ page }) => {
    await page.goto('/login');

    const forgotLink = page.locator('a[href="/forgot-password"]');
    await expect(forgotLink).toBeVisible();
    await forgotLink.click();

    await expect(page).toHaveURL(/.*forgot-password/);
  });
});
