import { test, expect } from '@playwright/test';

test.describe('Vaultix Swagger / OpenAPI Interactive Documentation', () => {
  // Desktop-only test
  test.skip(({ isMobile }) => isMobile, 'Swagger UI desktop verification');

  test('should serve OpenAPI 3.0 JSON specification with all tags and schemas', async ({ request }) => {
    const response = await request.get('http://localhost:4000/api-docs.json');
    expect(response.status()).toBe(200);

    const spec = await response.json();
    expect(spec.openapi).toBe('3.0.3');
    expect(spec.info.title).toContain('Vaultix');
    expect(Object.keys(spec.paths).length).toBeGreaterThanOrEqual(15);

    // Verify key security schemes and components
    expect(spec.components.securitySchemes.bearerAuth).toBeDefined();
    expect(spec.components.schemas.User).toBeDefined();
    expect(spec.components.schemas.PasswordItem).toBeDefined();
    expect(spec.components.schemas.CompanyVault).toBeDefined();
  });

  test('should render interactive Swagger UI dashboard with categorized tags and Authorize button', async ({ page }) => {
    await page.goto('http://localhost:4000/api-docs/');

    // 1. Verify Swagger UI page title & brand heading
    await expect(page).toHaveTitle(/Vaultix API Documentation/);
    const mainHeading = page.getByRole('heading', { level: 1 });
    await expect(mainHeading).toBeVisible();
    await expect(mainHeading).toContainText('Vaultix — Zero-Knowledge Enterprise Password Manager API');

    // 2. Verify "Authorize" button exists for JWT Bearer authentication
    const authBtn = page.getByRole('button', { name: 'Authorize' });
    await expect(authBtn).toBeVisible();

    // 3. Verify category section tags are rendered
    await expect(page.getByRole('link', { name: 'Authentication & Profile' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Personal Vault' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Company Vaults' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Credentials & Passwords' })).toBeVisible();

    // 4. Click an endpoint (e.g., /auth/login) to expand interactive schema and "Try it out"
    const loginLink = page.getByRole('link', { name: '/auth/login' });
    await expect(loginLink).toBeVisible();
    await loginLink.click();

    // Verify "Try it out" button is displayed
    const tryItOutBtn = page.getByRole('button', { name: 'Try it out' }).first();
    await expect(tryItOutBtn).toBeVisible();
  });
});
