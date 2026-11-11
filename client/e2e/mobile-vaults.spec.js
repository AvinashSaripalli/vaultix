import { test, expect } from '@playwright/test';

test.describe('Vaultix Dedicated Mobile Interface (<MobileRoot />)', () => {
  // Mobile-only tests
  test.skip(({ isMobile }) => !isMobile, 'Mobile interface tests');

  test.beforeEach(async ({ page }) => {
    // Intercept backend API calls with mock fixtures
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

      if (url.includes('/passwords/owned')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      }

      if (url.includes('/passwords/vault/')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'cpw-1',
              name: 'Jira Enterprise',
              login: 'eng@vaultix.pro',
              type: 'LOGIN',
              password: 'CompanySecretPass2026!',
              encryptedPassword: 'CompanySecretPass2026!',
              url: 'https://jira.vaultix.pro',
              updatedAt: new Date().toISOString(),
            },
          ]),
        });
      }

      if (url.includes('/folders/vault/')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { id: 'cf-1', name: 'DevOps', parentId: null },
          ]),
        });
      }

      if (url.includes('/vaults/engineering') || (url.includes('/vaults/') && !url.includes('/folders') && !url.includes('/passwords'))) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'cv-1',
            name: 'Engineering Vault',
            slug: 'engineering',
            type: 'COMPANY',
            description: 'Engineering team credentials',
          }),
        });
      }

      if (url.includes('/vaults') && method === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'cv-1',
              name: 'Engineering Vault',
              slug: 'engineering',
              type: 'COMPANY',
              description: 'Engineering team credentials',
            },
          ]),
        });
      }

      if (url.includes('/my-vault') && method === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            vault: { id: 'pv-1', name: 'Personal Vault', type: 'PERSONAL' },
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
                folder: { id: 'f-1', name: 'Work Logins' },
                url: 'https://github.com',
                password: 'MockPassword2026!',
                encryptedPassword: 'MockPassword2026!',
                updatedAt: new Date().toISOString(),
              },
            ],
          }),
        });
      }

      if (url.includes('/dashboard/security-summary') || url.includes('/dashboard')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            securityScore: 94,
            weakPasswords: 0,
            oldPasswords: 0,
            riskPasswords: 0,
            reusedPasswords: 0,
            totalPasswords: 5,
            stats: { totalVaults: 2, totalPasswords: 5, sharedPasswords: 1 },
          }),
        });
      }

      if (url.includes('/notifications')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            unreadCount: 0,
            notifications: [],
            items: [],
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

      // Default safe fallback
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });
  });

  const setupMobileAuthSession = async (page) => {
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
  };

  test('should display MobileAuthScreen and unlock vault with Master Password', async ({ page }) => {
    await setupMobileAuthSession(page);
    await page.goto('/?view=mobile');

    // 1. Verify MobileAuthScreen presence & user avatar card
    await expect(page.locator('h1:has-text("Vaultix")')).toBeVisible();
    await expect(page.locator('text=Mobile')).toBeVisible();
    await expect(page.locator('text=Vaultix Admin')).toBeVisible();
    await expect(page.locator('text=admin@vaultix.pro')).toBeVisible();

    // 2. Fill master password & unlock
    const masterPassInput = page.locator('input[placeholder="Enter your master password"]');
    await expect(masterPassInput).toBeVisible();
    await masterPassInput.fill('MasterPass2026!');

    const unlockBtn = page.locator('button[type="submit"]:has-text("Unlock Encrypted Vault")');
    await unlockBtn.click();

    // 3. Verify transition to MobileAppShell home screen & bottom navigation tabs (scoped to nav)
    const bottomNav = page.locator('nav');
    await expect(bottomNav.locator('button:has-text("Home")')).toBeVisible();
    await expect(bottomNav.locator('button:has-text("Vaults")')).toBeVisible();
    await expect(bottomNav.locator('button:has-text("Generate")')).toBeVisible();
    await expect(bottomNav.locator('button:has-text("Health")')).toBeVisible();
    await expect(bottomNav.locator('button:has-text("Settings")')).toBeVisible();

    // 4. Verify MobileHomeScreen greeting
    await expect(page.locator('text=Vaultix Mobile Workspace')).toBeVisible();
  });

  test('should switch between Personal Vault and Company Vault in MobileVaultsScreen', async ({ page }) => {
    await setupMobileAuthSession(page);
    await page.goto('/?view=mobile');

    // Unlock vault
    await page.locator('input[placeholder="Enter your master password"]').fill('MasterPass2026!');
    await page.locator('button[type="submit"]:has-text("Unlock Encrypted Vault")').click();

    // Tap Vaults tab in bottom navigation
    await page.locator('nav button:has-text("Vaults")').click();

    // Verify MobileVaultsScreen header
    await expect(page.locator('h1:has-text("Vaults")')).toBeVisible();

    // Verify Segmented Control exists
    const personalVaultBtn = page.locator('button:has-text("Personal Vault")');
    const companyVaultBtn = page.locator('button:has-text("Company Vault")');
    await expect(personalVaultBtn).toBeVisible();
    await expect(companyVaultBtn).toBeVisible();

    // Personal Vault items
    await expect(page.locator('h4:has-text("Github Account")')).toBeVisible();

    // Switch to Company Vault
    await companyVaultBtn.click();
    await expect(page.locator('h4:has-text("Jira Enterprise")')).toBeVisible();

    // Switch back to Personal Vault
    await personalVaultBtn.click();
    await expect(page.locator('h4:has-text("Github Account")')).toBeVisible();
  });

  test('should search and filter credentials inside MobileVaultsScreen', async ({ page }) => {
    await setupMobileAuthSession(page);
    await page.goto('/?view=mobile');

    // Unlock & navigate to Vaults tab
    await page.locator('input[placeholder="Enter your master password"]').fill('MasterPass2026!');
    await page.locator('button[type="submit"]:has-text("Unlock Encrypted Vault")').click();
    await page.locator('nav button:has-text("Vaults")').click();

    const searchInput = page.locator('input[placeholder="Search credentials, cards, notes..."]');
    await expect(searchInput).toBeVisible();

    // Filter matching item
    await searchInput.fill('Github');
    await expect(page.locator('h4:has-text("Github Account")')).toBeVisible();

    // Filter non-matching query
    await searchInput.fill('nonexistent-credential-xyz');
    await expect(page.locator('text=No matching items')).toBeVisible();

    // Clear search
    await searchInput.fill('');
    await expect(page.locator('h4:has-text("Github Account")')).toBeVisible();
  });

  test('should open MobileItemDetailSheet, reveal decrypted password, and open MobileItemEditorSheet', async ({ page }) => {
    await setupMobileAuthSession(page);
    await page.goto('/?view=mobile');

    // Unlock & navigate to Vaults tab
    await page.locator('input[placeholder="Enter your master password"]').fill('MasterPass2026!');
    await page.locator('button[type="submit"]:has-text("Unlock Encrypted Vault")').click();
    await page.locator('nav button:has-text("Vaults")').click();

    // Click item in list to open bottom detail sheet
    await page.locator('h4:has-text("Github Account")').click();

    // Verify MobileItemDetailSheet
    await expect(page.locator('h2:has-text("Github Account")')).toBeVisible();
    await expect(page.getByText('LOGIN', { exact: true })).toBeVisible();
    await expect(page.locator('p:has-text("dev@vaultix.pro")').first()).toBeVisible();

    // Verify password is masked initially
    await expect(page.locator('text=••••••••••••••••')).toBeVisible();

    // Click Eye button to reveal decrypted password
    const eyeBtn = page.locator('button[title="Show"]');
    await eyeBtn.click();
    await expect(page.locator('text=MockPassword2026!')).toBeVisible();

    // Click Edit button to open MobileItemEditorSheet
    const editBtn = page.locator('button[title="Edit item"]');
    await editBtn.click();

    // Verify MobileItemEditorSheet opens
    await expect(page.locator('h2:has-text("Edit Item")')).toBeVisible();
    const nameInput = page.locator('input[placeholder="e.g. GitHub, Netflix, Work WiFi"]');
    await expect(nameInput).toHaveValue('Github Account');

    const usernameInput = page.locator('input[placeholder="user@example.com"]');
    await expect(usernameInput).toHaveValue('dev@vaultix.pro');

    // Cancel edit sheet
    await page.locator('button:has-text("Cancel")').click();
    await expect(page.locator('h2:has-text("Edit Item")')).not.toBeVisible();
  });

  test('should navigate between bottom tabs: Generator and Health', async ({ page }) => {
    await setupMobileAuthSession(page);
    await page.goto('/?view=mobile');

    // Unlock vault
    await page.locator('input[placeholder="Enter your master password"]').fill('MasterPass2026!');
    await page.locator('button[type="submit"]:has-text("Unlock Encrypted Vault")').click();

    // 1. Navigate to Generator tab via bottom nav
    await page.locator('nav button:has-text("Generate")').click();
    await expect(page.locator('h1:has-text("Password Generator")')).toBeVisible();
    await expect(page.locator('text=Cryptographically secure, zero-knowledge entropy')).toBeVisible();

    // 2. Navigate to Health tab via bottom nav
    await page.locator('nav button:has-text("Health")').click();
    await expect(page.locator('h1:has-text("Security Health")')).toBeVisible();
    await expect(page.locator('text=Live vulnerability audit across your credentials')).toBeVisible();
    await expect(page.locator('text=Score: 94 / 100')).toBeVisible();
  });
});
