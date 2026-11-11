const swaggerUi = require('swagger-ui-express');

const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Vaultix — Zero-Knowledge Enterprise Password Manager API',
    version: '1.0.0',
    description: `
**Vaultix** is a military-grade, zero-knowledge encrypted password and secret management platform for individuals and enterprises.

### Architecture Highlights
- **Zero-Knowledge WebCrypto**: Cryptographic operations (AES-GCM-256, PBKDF2 salt derivation, RSA-4096 asymmetric key wrapping) are performed exclusively on the client side. The server never sees plaintext passwords, master passwords, or raw private keys.
- **Dual-Vault Paradigm**: Seamless segregation between private individual items (**Personal Vault**) and team workspace credentials (**Company Vaults**).
- **Enterprise Governance**: Granular role-based access control (SUPER_ADMIN, ADMIN, MEMBER, AUDITOR), department isolation, organization security policies, dual-approvals, and complete audit logging.

### Authentication
Most API endpoints require a **JSON Web Token (JWT)** passed in the \`Authorization\` header:
\`\`\`http
Authorization: Bearer <your_jwt_token>
\`\`\`
Use the **Authorize 🔓** button below to paste your access token and test endpoints interactively.
    `,
    contact: {
      name: 'Vaultix Security Team',
      email: 'security@vaultix.pro',
      url: 'https://vaultix.pro',
    },
    license: {
      name: 'Proprietary',
      url: 'https://vaultix.pro/terms',
    },
  },
  servers: [
    {
      url: '/api/v1',
      description: 'Current Environment API (v1)',
    },
    {
      url: 'http://localhost:4000/api/v1',
      description: 'Local Development Server',
    },
  ],
  tags: [
    { name: 'Authentication & Profile', description: 'User registration, login, JWT lifecycle, and account settings' },
    { name: 'Master Password & Cryptography', description: 'Master password verification, recovery keys, and RSA keypair exchanges' },
    { name: 'Personal Vault', description: 'Zero-knowledge private vault storage, folders, and trash recovery' },
    { name: 'Company Vaults', description: 'Shared organizational vaults, team workspaces, and access policies' },
    { name: 'Credentials & Passwords', description: 'Encrypted credential lifecycle, secret notes, custom fields, and wrapping' },
    { name: 'Folders & Hierarchy', description: 'Vault folder management, permissions, and hierarchical organization' },
    { name: 'Two-Factor Authentication (2FA)', description: 'TOTP authenticator apps, WebAuthn / Passkeys, and vault timeout settings' },
    { name: 'Security Health & Dashboard', description: 'Vulnerability audits, password strength analytics, and breach analysis' },
    { name: 'Team & Departments', description: 'User roles, member invitations, departments, and delegations' },
    { name: 'Audit & Governance', description: 'Immutable activity logs, login history, and admin approval workflows' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your Bearer JWT token obtained from `/auth/login` or `/auth/refresh`.',
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'Invalid credentials or resource not found' },
          error: { type: 'string', example: 'Unauthorized' },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid', example: 'b82d49b5-47fe-49fa-9be8-a95e0c52ebf3' },
          email: { type: 'string', format: 'email', example: 'admin@vaultix.pro' },
          fullName: { type: 'string', example: 'Vaultix Administrator' },
          role: { type: 'string', enum: ['SUPER_ADMIN', 'ADMIN', 'MEMBER', 'AUDITOR'], example: 'ADMIN' },
          isEmailVerified: { type: 'boolean', example: true },
          hasMasterPassword: { type: 'boolean', example: true },
          encryptionSalt: { type: 'string', example: 'dGVzdC1zYWx0LTEyMzQ1Njc4' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      RegisterRequest: {
        type: 'object',
        required: ['email', 'password', 'fullName'],
        properties: {
          fullName: { type: 'string', example: 'Alice Smith' },
          email: { type: 'string', format: 'email', example: 'alice@vaultix.pro' },
          password: { type: 'string', format: 'password', example: 'SecureAccountPass2026!' },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'admin@vaultix.pro' },
          password: { type: 'string', format: 'password', example: 'AdminPass2026!' },
          twoFactorCode: { type: 'string', example: '123456', description: 'Optional 6-digit TOTP code if 2FA is active' },
        },
      },
      LoginResponse: {
        type: 'object',
        properties: {
          token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
          user: { $ref: '#/components/schemas/User' },
          require2FA: { type: 'boolean', example: false },
          twoFactorMethod: { type: 'string', example: 'totp' },
        },
      },
      VerifyMasterPasswordRequest: {
        type: 'object',
        required: ['authKey'],
        properties: {
          authKey: { type: 'string', example: 'derived-sha256-auth-key-hash', description: 'PBKDF2 client-derived master authentication key' },
          masterPassword: { type: 'string', description: 'Optional fallback verifier if salt migration needed' },
        },
      },
      SetMasterPasswordRequest: {
        type: 'object',
        required: ['encryptionSalt', 'authKeyHash', 'verifier'],
        properties: {
          encryptionSalt: { type: 'string', example: 'base64-random-salt-16bytes' },
          authKeyHash: { type: 'string', example: 'hash-of-authkey-for-zero-knowledge' },
          verifier: { type: 'string', example: 'aes-gcm-master-verifier-token' },
          encryptedPrivateKey: { type: 'string', example: 'encrypted-rsa-private-key' },
          publicKey: { type: 'string', example: 'rsa-4096-public-key-pem' },
        },
      },
      PasswordItem: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid', example: 'e3b8a1c9-58d4-4bb8-95a2-97ecbf1e3e88' },
          name: { type: 'string', example: 'GitHub Enterprise' },
          type: { type: 'string', enum: ['LOGIN', 'CARD', 'SECURE_NOTE', 'IDENTITY', 'SERVER', 'DATABASE'], example: 'LOGIN' },
          login: { type: 'string', example: 'dev@vaultix.pro' },
          encryptedPassword: { type: 'string', example: '{"iv":"...","data":"..."}' },
          encryptedNote: { type: 'string', example: '{"iv":"...","data":"..."}' },
          encryptedFields: { type: 'string', example: '{"iv":"...","data":"..."}' },
          url: { type: 'string', example: 'https://github.com' },
          folderId: { type: 'string', format: 'uuid', nullable: true },
          vaultId: { type: 'string', format: 'uuid', nullable: true },
          isSensitive: { type: 'boolean', example: false },
          strengthScore: { type: 'integer', minimum: 0, maximum: 5, example: 5 },
          atRisk: { type: 'boolean', example: false },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      CreatePasswordRequest: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', example: 'AWS Production IAM' },
          type: { type: 'string', example: 'LOGIN' },
          login: { type: 'string', example: 'cloud-admin@vaultix.pro' },
          encryptedPassword: { type: 'string', example: '{"iv":"...","data":"..."}' },
          encryptedNote: { type: 'string', example: '{"iv":"...","data":"..."}' },
          encryptedFields: { type: 'string', example: '{"iv":"...","data":"..."}' },
          wrappedKeys: { type: 'object', description: 'RSA-wrapped item keys for authorized users' },
          url: { type: 'string', example: 'https://aws.amazon.com' },
          vaultId: { type: 'string', format: 'uuid' },
          folderId: { type: 'string', format: 'uuid', nullable: true },
          isSensitive: { type: 'boolean', example: false },
          strengthScore: { type: 'integer', example: 5 },
          atRisk: { type: 'boolean', example: false },
        },
      },
      Folder: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid', example: 'f87a3120-1a22-48ec-8fbd-197063d89312' },
          name: { type: 'string', example: 'DevOps & Infrastructure' },
          parentId: { type: 'string', format: 'uuid', nullable: true },
          vaultId: { type: 'string', format: 'uuid', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          _count: {
            type: 'object',
            properties: {
              passwords: { type: 'integer', example: 8 },
            },
          },
        },
      },
      CompanyVault: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid', example: 'cv-99a8b1-4190' },
          name: { type: 'string', example: 'Engineering Vault' },
          slug: { type: 'string', example: 'engineering-vault' },
          type: { type: 'string', example: 'COMPANY' },
          description: { type: 'string', example: 'Engineering & Infrastructure shared secrets' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      SecuritySummary: {
        type: 'object',
        properties: {
          securityScore: { type: 'integer', example: 94 },
          totalPasswords: { type: 'integer', example: 25 },
          weakPasswords: { type: 'integer', example: 1 },
          oldPasswords: { type: 'integer', example: 2 },
          riskPasswords: { type: 'integer', example: 0 },
          reusedPasswords: { type: 'integer', example: 0 },
        },
      },
      TOTPStatusResponse: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean', example: true },
          method: { type: 'string', example: 'authenticator' },
          backupCodesCount: { type: 'integer', example: 10 },
        },
      },
    },
  },
  paths: {
    // ─── AUTHENTICATION ────────────────────────────────────────────────────────
    '/auth/register': {
      post: {
        tags: ['Authentication & Profile'],
        summary: 'Register a new Vaultix user account',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/RegisterRequest' } },
          },
        },
        responses: {
          201: {
            description: 'User registered successfully',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginResponse' } } },
          },
          400: { description: 'Email already exists or invalid data', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Authentication & Profile'],
        summary: 'Authenticate with email and account password',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } },
          },
        },
        responses: {
          200: {
            description: 'Login successful, returns JWT and user profile (or 2FA challenge)',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginResponse' } } },
          },
          401: { description: 'Invalid credentials', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Authentication & Profile'],
        summary: 'Get current authenticated user profile',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Current user profile information',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } },
          },
          401: { description: 'Unauthorized — missing or invalid JWT' },
        },
      },
      put: {
        tags: ['Authentication & Profile'],
        summary: 'Update current user profile information',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  fullName: { type: 'string', example: 'Alex Morgan' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Profile updated successfully' },
        },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Authentication & Profile'],
        summary: 'Refresh access token using httpOnly refresh cookie',
        responses: {
          200: {
            description: 'New access token issued',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { token: { type: 'string' } },
                },
              },
            },
          },
          401: { description: 'Session expired or invalid refresh cookie' },
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Authentication & Profile'],
        summary: 'Logout user and clear server refresh session cookies',
        responses: {
          200: { description: 'Logged out successfully' },
        },
      },
    },
    '/auth/forgot-password': {
      post: {
        tags: ['Authentication & Profile'],
        summary: 'Request an account password reset link via email',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: { email: { type: 'string', format: 'email' } },
              },
            },
          },
        },
        responses: {
          200: { description: 'Reset email sent if account exists' },
        },
      },
    },
    '/auth/reset-password': {
      post: {
        tags: ['Authentication & Profile'],
        summary: 'Reset account password with reset token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['token', 'password'],
                properties: {
                  token: { type: 'string' },
                  password: { type: 'string', format: 'password' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Password reset successful' },
        },
      },
    },

    // ─── MASTER PASSWORD & CRYPTO ──────────────────────────────────────────────
    '/auth/verify-master-password': {
      post: {
        tags: ['Master Password & Cryptography'],
        summary: 'Verify master password auth key with zero knowledge',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/VerifyMasterPasswordRequest' } },
          },
        },
        responses: {
          200: { description: 'Master password successfully verified' },
          401: { description: 'Invalid master password' },
        },
      },
    },
    '/auth/set-master-password': {
      post: {
        tags: ['Master Password & Cryptography'],
        summary: 'Initialize master password and cryptographic salt on user setup',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/SetMasterPasswordRequest' } },
          },
        },
        responses: {
          200: { description: 'Master password configured' },
        },
      },
    },
    '/keypair': {
      get: {
        tags: ['Master Password & Cryptography'],
        summary: 'Fetch encrypted RSA keypair for current user',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'User RSA asymmetric keypair data',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    encryptedPrivateKey: { type: 'string', nullable: true },
                    publicKey: { type: 'string', nullable: true },
                    salt: { type: 'string', nullable: true },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Master Password & Cryptography'],
        summary: 'Upload or update encrypted RSA keypair',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['encryptedPrivateKey', 'publicKey'],
                properties: {
                  encryptedPrivateKey: { type: 'string' },
                  publicKey: { type: 'string' },
                  salt: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Keypair stored successfully' },
        },
      },
    },

    // ─── PERSONAL VAULT (MY VAULT) ─────────────────────────────────────────────
    '/my-vault': {
      get: {
        tags: ['Personal Vault'],
        summary: 'Get or create user personal vault (with folders & items)',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Personal vault object, folders, and encrypted passwords',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    vault: { type: 'object' },
                    folders: { type: 'array', items: { $ref: '#/components/schemas/Folder' } },
                    passwords: { type: 'array', items: { $ref: '#/components/schemas/PasswordItem' } },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/my-vault/passwords': {
      get: {
        tags: ['Personal Vault'],
        summary: 'List all items in Personal Vault',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Array of personal password items',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/PasswordItem' } } } },
          },
        },
      },
      post: {
        tags: ['Personal Vault'],
        summary: 'Create a new encrypted item in Personal Vault',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreatePasswordRequest' } } },
        },
        responses: {
          201: { description: 'Item created in Personal Vault', content: { 'application/json': { schema: { $ref: '#/components/schemas/PasswordItem' } } } },
        },
      },
    },
    '/my-vault/passwords/{passwordId}': {
      put: {
        tags: ['Personal Vault'],
        summary: 'Update an existing item in Personal Vault',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'passwordId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreatePasswordRequest' } } },
        },
        responses: {
          200: { description: 'Personal item updated' },
        },
      },
      delete: {
        tags: ['Personal Vault'],
        summary: 'Move an item to Personal Vault trash',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'passwordId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          200: { description: 'Item moved to trash' },
        },
      },
    },
    '/my-vault/trash': {
      get: {
        tags: ['Personal Vault'],
        summary: 'List deleted items in Personal Vault trash bin',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Array of deleted items',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/PasswordItem' } } } },
          },
        },
      },
    },

    // ─── COMPANY VAULTS ────────────────────────────────────────────────────────
    '/vaults': {
      get: {
        tags: ['Company Vaults'],
        summary: 'List accessible organizational company vaults',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'List of accessible company vaults',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/CompanyVault' } } } },
          },
        },
      },
      post: {
        tags: ['Company Vaults'],
        summary: 'Create a new Company Vault (Admin required)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string', example: 'Finance Team Vault' },
                  description: { type: 'string', example: 'Banking credentials & financial portals' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Vault created successfully', content: { 'application/json': { schema: { $ref: '#/components/schemas/CompanyVault' } } } },
        },
      },
    },
    '/vaults/{slug}': {
      get: {
        tags: ['Company Vaults'],
        summary: 'Get company vault details by slug identifier',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Vault details', content: { 'application/json': { schema: { $ref: '#/components/schemas/CompanyVault' } } } },
        },
      },
    },

    // ─── CREDENTIALS & PASSWORDS ───────────────────────────────────────────────
    '/passwords': {
      post: {
        tags: ['Credentials & Passwords'],
        summary: 'Create an encrypted password item in a Company Vault',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreatePasswordRequest' } } },
        },
        responses: {
          201: { description: 'Item created successfully' },
        },
      },
    },
    '/passwords/vault/{vaultId}': {
      get: {
        tags: ['Credentials & Passwords'],
        summary: 'Get all passwords within a specified company vault',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'vaultId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          200: {
            description: 'List of passwords in vault',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/PasswordItem' } } } },
          },
        },
      },
    },
    '/passwords/{id}': {
      get: {
        tags: ['Credentials & Passwords'],
        summary: 'Get password details and metadata by ID',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          200: { content: { 'application/json': { schema: { $ref: '#/components/schemas/PasswordItem' } } } },
        },
      },
      put: {
        tags: ['Credentials & Passwords'],
        summary: 'Update password encrypted data and fields',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreatePasswordRequest' } } },
        },
        responses: {
          200: { description: 'Password updated' },
        },
      },
      delete: {
        tags: ['Credentials & Passwords'],
        summary: 'Soft-delete password item (moves to trash)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          200: { description: 'Password deleted' },
        },
      },
    },

    // ─── FOLDERS & HIERARCHY ───────────────────────────────────────────────────
    '/folders/vault/{vaultId}': {
      get: {
        tags: ['Folders & Hierarchy'],
        summary: 'Get all folders for a specific company vault',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'vaultId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          200: {
            description: 'List of folders',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Folder' } } } },
          },
        },
      },
    },
    '/folders': {
      post: {
        tags: ['Folders & Hierarchy'],
        summary: 'Create a new folder in a Company Vault',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'vaultId'],
                properties: {
                  name: { type: 'string', example: 'API Tokens & Secrets' },
                  vaultId: { type: 'string', format: 'uuid' },
                  parentId: { type: 'string', format: 'uuid', nullable: true },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Folder created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Folder' } } } },
        },
      },
    },

    // ─── 2FA & SECURITY ────────────────────────────────────────────────────────
    '/2fa/totp/status': {
      get: {
        tags: ['Two-Factor Authentication (2FA)'],
        summary: 'Get current user TOTP 2FA enrollment status',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'TOTP status',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/TOTPStatusResponse' } } },
          },
        },
      },
    },
    '/2fa/totp/setup': {
      post: {
        tags: ['Two-Factor Authentication (2FA)'],
        summary: 'Initiate TOTP setup (generates QR code and secret)',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'TOTP setup payload with QR code and secret',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    secret: { type: 'string' },
                    qrCode: { type: 'string', description: 'Data URL containing PNG QR code image' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/2fa/totp/verify-enable': {
      post: {
        tags: ['Two-Factor Authentication (2FA)'],
        summary: 'Verify code and permanently enable TOTP',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['token'],
                properties: { token: { type: 'string', example: '123456' } },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'TOTP enabled, returns one-time backup recovery codes',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    backupCodes: { type: 'array', items: { type: 'string' } },
                  },
                },
              },
            },
          },
        },
      },
    },

    // ─── DASHBOARD & HEALTH ────────────────────────────────────────────────────
    '/dashboard/security-summary': {
      get: {
        tags: ['Security Health & Dashboard'],
        summary: 'Get overall security audit summary (weak, old, risk scores)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'vaultType', in: 'query', schema: { type: 'string', enum: ['PERSONAL', 'COMPANY'], default: 'PERSONAL' } },
        ],
        responses: {
          200: {
            description: 'Security health score and vulnerability counters',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SecuritySummary' } } },
          },
        },
      },
    },
    '/dashboard/password-activity': {
      get: {
        tags: ['Security Health & Dashboard'],
        summary: 'Get password audit activity trends over time',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'range', in: 'query', schema: { type: 'string', enum: ['7D', '30D', '90D'], default: '7D' } },
        ],
        responses: {
          200: { description: 'Activity event timeline' },
        },
      },
    },

    // ─── TEAM & DEPARTMENTS ────────────────────────────────────────────────────
    '/departments': {
      get: {
        tags: ['Team & Departments'],
        summary: 'List organization departments and member counts',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'List of departments' },
        },
      },
      post: {
        tags: ['Team & Departments'],
        summary: 'Create a new department (Admin only)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string', example: 'Cybersecurity Operations' },
                  description: { type: 'string', example: 'SecOps and Incident Response' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Department created' },
        },
      },
    },
    '/users': {
      get: {
        tags: ['Team & Departments'],
        summary: 'List all organization members and assigned roles',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'List of users',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/User' } } } },
          },
        },
      },
    },

    // ─── AUDIT & GOVERNANCE ────────────────────────────────────────────────────
    '/activity': {
      get: {
        tags: ['Audit & Governance'],
        summary: 'Query immutable security audit activity logs',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: {
          200: { description: 'Audit log entries and pagination metadata' },
        },
      },
    },
    '/notifications': {
      get: {
        tags: ['Audit & Governance'],
        summary: 'Get user notifications and unread alert counts',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Notifications list and unread count' },
        },
      },
    },
  },
};

const swaggerUiOptions = {
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info { margin-bottom: 24px }
    .swagger-ui .info .title { font-size: 28px; color: #4f46e5; font-weight: 800; }
    .swagger-ui .info p { font-size: 14px; line-height: 1.6; }
    .swagger-ui .scheme-container { background: #f8fafc; border-radius: 12px; padding: 16px; margin-bottom: 24px; }
    .swagger-ui .btn.authorize { background: #4f46e5; color: #fff; border-color: #4f46e5; border-radius: 8px; }
    .swagger-ui .btn.authorize svg { fill: #fff; }
    .swagger-ui .opblock.opblock-post { border-color: #4f46e5; background: rgba(79, 70, 229, 0.04); }
    .swagger-ui .opblock.opblock-post .opblock-summary-method { background: #4f46e5; }
    .swagger-ui .opblock.opblock-get { border-color: #059669; background: rgba(5, 150, 105, 0.04); }
    .swagger-ui .opblock.opblock-get .opblock-summary-method { background: #059669; }
    .swagger-ui .opblock.opblock-put { border-color: #d97706; background: rgba(217, 119, 6, 0.04); }
    .swagger-ui .opblock.opblock-put .opblock-summary-method { background: #d97706; }
    .swagger-ui .opblock.opblock-delete { border-color: #e11d48; background: rgba(225, 29, 72, 0.04); }
    .swagger-ui .opblock.opblock-delete .opblock-summary-method { background: #e11d48; }
  `,
  customSiteTitle: 'Vaultix API Documentation & Playground',
};

module.exports = {
  swaggerUi,
  swaggerSpec,
  swaggerUiOptions,
};
