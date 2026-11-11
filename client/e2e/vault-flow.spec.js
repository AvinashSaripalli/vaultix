import { test, expect } from '@playwright/test';

test.describe('Vaultix Master Password & Desktop Vault Flow', () => {
  // Desktop-specific tests
  test.skip(({ isMobile }) => isMobile, 'Desktop web vault flow');

  test.beforeEach(async ({ page }) => {
    // Intercept ALL backend API calls to ensure zero 401 errors
    await page.route('**/api/v1/**', async (route) => {
      const url = route.request().url();
      const method = route.request().method();

      if (url.includes('/auth/me') || url.includes('/users/me')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'user-1',
            email: 'admin@vaultix.pro',
            fullName: 'Vaultix Admin',
            role: 'ADMIN',
            hasMasterPassword: true,
            encryptionSalt: 'dGVzdC1zYWx0LTEyMzQ1Njc4',
          }),
        });
      }

      if (url.includes('/auth/verify-master-password')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      }

      if (url.includes('/auth/refresh')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ token: 'mock-valid-token' }),
        });
      }

      if (url.includes('/my-vault/trash') || url.includes('/my-vault/folders/trash')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      }

      if (url.includes('/my-vault/passwords') && method === 'POST') {
        const postData = route.request().postDataJSON() || {};
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'pw-new-1',
            name: postData.name || 'AWS Cloud Account',
            login: postData.login || 'cloud-admin@vaultix.pro',
            type: 'LOGIN',
            folderId: postData.folderId || 'f-1',
            encryptedPassword: postData.encryptedPassword || '',
            encryptedFields: postData.encryptedFields || '',
            encryptedNote: postData.encryptedNote || '',
            updatedAt: new Date().toISOString(),
          }),
        });
      }

      if (url.includes('/my-vault') && method === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            vault: { id: 'pv-1', name: 'Personal Vault' },
            folders: [
              { id: 'f-1', name: 'Work Logins', parentId: null, _count: { passwords: 1 } },
            ],
            passwords: [
              {
                id: 'pw-1',
                name: 'Github Account',
                login: 'dev@vaultix.pro',
                type: 'LOGIN',
                folderId: 'f-1',
                website: 'https://github.com',
                encryptedPassword: 'MockPassword2026!',
                updatedAt: new Date().toISOString(),
              },
            ],
          }),
        });
      }

      if (url.includes('/keypair')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            encryptedPrivateKey: null,
            publicKey: null,
            salt: null,
          }),
        });
      }

      if (url.includes('/vaults')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { id: 'cv-1', name: 'Engineering Vault', slug: 'engineering', description: 'Engineering team credentials' },
          ]),
        });
      }

      if (url.includes('/dashboard')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            stats: { totalVaults: 2, totalPasswords: 10, sharedPasswords: 3 },
            recentActivity: [],
          }),
        });
      }

      // Default safe response
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });
  });

  test('should display Master Password prompt for logged-in user', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('token', 'mock-valid-token');
      localStorage.setItem('vaultix-last-activity', String(Date.now()));
      localStorage.setItem(
        'user',
        JSON.stringify({
          id: 'user-1',
          email: 'admin@vaultix.pro',
          fullName: 'Vaultix Admin',
          role: 'ADMIN',
          hasMasterPassword: true,
          encryptionSalt: 'dGVzdC1zYWx0LTEyMzQ1Njc4',
        })
      );
    });

    await page.goto('/enter-master-password');

    // Verify title/header
    const heading = page.locator('h2:has-text("Unlock vault")');
    await expect(heading).toBeVisible();

    // Verify password input and unlock button
    const masterPassInput = page.locator('input[placeholder="Master password"]');
    const unlockBtn = page.locator('button[type="submit"]:has-text("Unlock Vault")');

    await expect(masterPassInput).toBeVisible();
    await expect(unlockBtn).toBeVisible();
  });

  test('should unlock vault and navigate to dashboard when entering master password', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('token', 'mock-valid-token');
      localStorage.setItem('vaultix-last-activity', String(Date.now()));
      localStorage.setItem(
        'user',
        JSON.stringify({
          id: 'user-1',
          email: 'admin@vaultix.pro',
          fullName: 'Vaultix Admin',
          role: 'ADMIN',
          hasMasterPassword: true,
          encryptionSalt: 'dGVzdC1zYWx0LTEyMzQ1Njc4',
        })
      );
    });

    await page.goto('/enter-master-password');

    const masterPassInput = page.locator('input[placeholder="Master password"]');
    await masterPassInput.fill('MasterPass2026!');

    const unlockBtn = page.locator('button[type="submit"]:has-text("Unlock Vault")');
    await unlockBtn.click();

    // After unlocking, should redirect to dashboard
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('should unlock and access Personal Vault with search filter', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('token', 'mock-valid-token');
      localStorage.setItem('vaultix-last-activity', String(Date.now()));
      localStorage.setItem(
        'user',
        JSON.stringify({
          id: 'user-1',
          email: 'admin@vaultix.pro',
          fullName: 'Vaultix Admin',
          role: 'ADMIN',
          hasMasterPassword: true,
          encryptionSalt: 'dGVzdC1zYWx0LTEyMzQ1Njc4',
        })
      );
    });

    // 1. Perform master password unlock
    await page.goto('/enter-master-password');
    await page.locator('input[placeholder="Master password"]').fill('MasterPass2026!');
    await page.locator('button[type="submit"]:has-text("Unlock Vault")').click();
    await expect(page).toHaveURL(/.*dashboard/);

    // 2. Click Personal Vault in the desktop sidebar
    const myVaultLink = page.locator('a[href="/my-vault"]').first();
    await myVaultLink.click({ force: true });
    await expect(page).toHaveURL(/.*my-vault/);

    // 3. Verify Personal Vault header & search
    await expect(page.locator('h1:has-text("My Vault")')).toBeVisible();
    const searchInput = page.locator('input[placeholder*="Search"]');
    await expect(searchInput).toBeVisible();

    // 4. Type search query
    await searchInput.fill('Github');
    await expect(page.locator('text=Github Account').first()).toBeVisible();
  });

  test('should create a password item using generator and reveal/decrypt it', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('token', 'mock-valid-token');
      localStorage.setItem('vaultix-last-activity', String(Date.now()));
      localStorage.setItem(
        'user',
        JSON.stringify({
          id: 'user-1',
          email: 'admin@vaultix.pro',
          fullName: 'Vaultix Admin',
          role: 'ADMIN',
          hasMasterPassword: true,
          encryptionSalt: 'dGVzdC1zYWx0LTEyMzQ1Njc4',
        })
      );
    });

    // 1. Perform master password unlock
    await page.goto('/enter-master-password');
    await page.locator('input[placeholder="Master password"]').fill('MasterPass2026!');
    await page.locator('button[type="submit"]:has-text("Unlock Vault")').click();
    await expect(page).toHaveURL(/.*dashboard/);

    // 2. Navigate to Personal Vault
    await page.locator('a[href="/my-vault"]').first().click({ force: true });
    await expect(page).toHaveURL(/.*my-vault/);

    // 3. Click "Add Item" button
    const addItemBtn = page.locator('button:has-text("Add Item")');
    await expect(addItemBtn).toBeVisible();
    await addItemBtn.click();

    // 4. Verify Add Item Modal is open
    await expect(page.locator('h2:has-text("Add Item")')).toBeVisible();

    // Select Folder
    const folderSelect = page.locator('select');
    if (await folderSelect.isVisible()) {
      await folderSelect.selectOption({ label: 'Work Logins' });
    }

    // Fill Item Title
    const titleInput = page.locator('input[placeholder="e.g. Gmail"]');
    await titleInput.fill('AWS Cloud Account');

    // Fill Login
    const loginInput = page.locator('input[placeholder="e.g. user@example.com"]');
    await loginInput.fill('cloud-admin@vaultix.pro');

    // 5. Test built-in Password Generator button
    const generateBtn = page.locator('button:has-text("Generate")');
    await generateBtn.click();

    // Verify generated secret was populated
    const secretInput = page.locator('input[placeholder="Enter or generate secret"]');
    const generatedVal = await secretInput.inputValue();
    expect(generatedVal.length).toBeGreaterThanOrEqual(16);

    // 6. Click "Save Item" (Triggers WebCrypto AES-GCM encryption)
    const saveBtn = page.locator('button:has-text("Save Item")');
    await saveBtn.click();

    // Modal closes upon successful save
    await expect(page.locator('h2:has-text("Add Item")')).not.toBeVisible();

    // 7. Select existing item "Github Account" to verify password reveal
    const githubItem = page.locator('button:has-text("Github Account")').first();
    await githubItem.click();

    // Verify password is initially masked
    await expect(page.locator('text=••••••••••••').first()).toBeVisible();

    // 8. Click the eye icon to reveal
    const revealBtn = page.locator('button[aria-label="Show password"]');
    await revealBtn.click();

    // Verify cleartext password is now rendered
    await expect(page.locator('text=MockPassword2026!')).toBeVisible();
  });
});
