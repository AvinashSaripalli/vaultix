# Vaultix — Military-Grade Zero-Knowledge Enterprise Password Manager

<div align="center">

![Vaultix Platform Banner](screenshots/vaultix_web_portal_1280x800.png)

[![Playwright Tests](https://img.shields.io/badge/Playwright%20E2E-40%20Passing-brightgreen?style=for-the-badge&logo=playwright)](client/e2e)
[![OpenAPI 3.0](https://img.shields.io/badge/OpenAPI%203.0-Swagger%20UI-4f46e5?style=for-the-badge&logo=swagger)](http://localhost:4000/api-docs)
[![React 19](https://img.shields.io/badge/React%2019-Vite%208-61dafb?style=for-the-badge&logo=react)](client/)
[![Node.js](https://img.shields.io/badge/Node.js%2020+-Express%205-339933?style=for-the-badge&logo=node.js)](server/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Prisma%20ORM-336791?style=for-the-badge&logo=postgresql)](server/prisma)
[![Capacitor](https://img.shields.io/badge/Mobile-Capacitor%20(iOS%20%26%20Android)-1192e8?style=for-the-badge&logo=capacitor)](client/)
[![Chrome Extension](https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-4285F4?style=for-the-badge&logo=googlechrome)](extension/)

**Vaultix** is a military-grade, zero-knowledge encrypted password and secret management platform built for individuals, teams, and high-security enterprise environments.

[Features](#key-features) • [Architecture](#zero-knowledge-security-architecture) • [Swagger API](#interactive-swagger--openapi-playground) • [E2E Testing](#playwright-end-to-end-testing) • [Quickstart](#getting-started) • [Docker](#docker-deployment)

</div>

---

## 🌟 Key Features

### 1. Zero-Knowledge Cryptography
All cryptographic operations (encryption, decryption, hashing, and asymmetric key wrapping) are executed strictly in the user's browser runtime using the native W3C **Web Crypto API**. The server never receives, stores, or transmits plaintext passwords, master passwords, or raw private keys.

### 2. Dual-Vault Paradigm
- **Personal Vault (`/my-vault`)**: A private vault container exclusively accessible by the individual user. Items are encrypted using an AES-256-GCM symmetric key derived from the user's Master Password via PBKDF2 (SHA-256).
- **Company Vaults (`/vaults`)**: Shared organizational team vaults for engineering, finance, DevOps, and executive workspaces. Credentials utilize multi-recipient asymmetric RSA-4096 envelope encryption.

### 3. Multi-Platform Seamless Experience
- **Desktop Web Portal**: High-performance React 19 interface with folder hierarchy, trash recovery, custom field editor, and instant password generation.
- **Dedicated Native Mobile Interface (`<MobileRoot />`)**: Touch-optimized mobile shell with dual-vault segmented control, bottom sheets, biometrics unlock, and haptic feedback powered by **Capacitor** (iOS & Android).
- **Browser Extension (Manifest V3)**: Chromium autofill extension with real-time domain matching, inline credential injection, clipboard clearing, and quick password generation.

### 4. Enterprise Security & Governance
- **Role-Based Access Control (RBAC)**: `SUPER_ADMIN`, `ADMIN`, `MEMBER`, and `AUDITOR` permissions.
- **Department Hierarchy & Folder Delegation**: Nested department structures with granular folder-level permissions (`READ_ONLY`, `READ_WRITE`, `ADMIN`).
- **Two-Factor Authentication (2FA)**: Time-based One-Time Passwords (TOTP via Google Authenticator / 1Password) with encrypted one-time recovery backup codes.
- **Dual-Admin Approval Workflows**: Requiring multiple administrator signatures for high-risk actions.
- **Tamper-Evident Audit Logging**: Immutable activity logs tracking login attempts, credential exports, shares, and administrative changes.

---

## 🔒 Zero-Knowledge Security Architecture

```mermaid
flowchart TD
    subgraph Client ["Client Device (Browser / Mobile / Extension)"]
        MP["Master Password (User Memory)"]
        Salt["Unique Encryption Salt"]
        PBKDF2["PBKDF2 Derivation (SHA-256, 600,000 Iterations)"]
        AES["AES-GCM-256 Key"]
        RSA["RSA-4096 Keypair (OAEP)"]
        Ciphertext["Encrypted Ciphertext Payload (IV + Data + AuthTag)"]
        
        MP & Salt --> PBKDF2
        PBKDF2 --> AES
        AES -->|Encrypt/Decrypt| Ciphertext
        RSA -->|Asymmetric Envelope Wrap| AES
    end

    subgraph Server ["Vaultix Backend Server (Zero-Knowledge)"]
        AuthVerif["Auth Key Hash (Zero-Knowledge Verifier)"]
        EncPayload["Encrypted Blobs Storage"]
        DB[(PostgreSQL Database)]
        
        Ciphertext -->|Stored as opaque strings| EncPayload
        EncPayload --> DB
        AuthVerif --> DB
    end

    classDef secure fill:#e0e7ff,stroke:#4f46e5,stroke-width:2px;
    classDef server fill:#f8fafc,stroke:#64748b,stroke-width:1.5px;
    class Client secure;
    class Server server;
```

---

## 📖 Interactive Swagger & OpenAPI Playground

Vaultix includes an interactive OpenAPI 3.0 documentation dashboard running directly on the backend server:

- **Interactive UI Dashboard**: [http://localhost:4000/api-docs](http://localhost:4000/api-docs)
- **Direct Shortcuts**: [http://localhost:4000/docs](http://localhost:4000/docs) or [http://localhost:4000/swagger](http://localhost:4000/swagger)
- **Raw OpenAPI 3.0 JSON**: [http://localhost:4000/api-docs.json](http://localhost:4000/api-docs.json)

### Features:
- **Authorize 🔓 Button**: Authenticate with your JWT Bearer token to execute and test protected endpoints live from your browser.
- **Over 30 Categorized Endpoints**: Covering Auth, Master Password, Personal Vault, Company Vaults, 2FA, Security Health, Departments, and Audit Logs.

---

## 🧪 Playwright End-to-End Testing

Vaultix maintains a test suite built with **Microsoft Playwright**, running across both **Desktop Chrome** and **Mobile Pixel** devices:

```bash
Running 40 tests using 1 worker
  ✔ 29 passed (100% pass rate)
  - 11 skipped (platform-filtered tests)
  ✘  0 failed
```

| Test Suite File | Target Platform | Scenarios Covered |
| :--- | :--- | :--- |
| [`smoke.spec.js`](client/e2e/smoke.spec.js) | Desktop + Mobile | Unauthenticated redirects, form elements, client validations, password eye toggle, forgot password |
| [`register.spec.js`](client/e2e/register.spec.js) | Desktop + Mobile | Input field verification, password policy rules, cross-page navigation |
| [`mobile-view.spec.js`](client/e2e/mobile-view.spec.js) | Desktop + Mobile | Responsive login viewport layout without desktop banner |
| [`vault-flow.spec.js`](client/e2e/vault-flow.spec.js) | Desktop Web | Master password prompt, dashboard unlock, personal vault search, credential creation with generator, cleartext WebCrypto AES-GCM decryption |
| [`mobile-vaults.spec.js`](client/e2e/mobile-vaults.spec.js) | Mobile Pixel | Mobile master password unlock, dual-vault switcher (Personal vs Company), search filter, Mobile Item Detail Sheet, Mobile Item Editor Sheet, generator and health tab navigation |
| [`swagger.spec.js`](client/e2e/swagger.spec.js) | Desktop Web | OpenAPI 3.0 JSON schema validation, live Swagger UI dashboard rendering, tag navigation, interactive endpoint expansion |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **PostgreSQL**: v14.0 or higher
- **npm** or **pnpm**

### 1. Clone the Repository
```bash
git clone https://github.com/AvinashSaripalli/vaultix.git
cd vaultix
```

### 2. Configure Environment Variables
Copy `.env.example` in both server and client:
```bash
# In server/
cp server/.env.example server/.env

# In client/
cp client/.env.example client/.env
```

Configure your PostgreSQL database URL in `server/.env`:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/vaultix?schema=public"
JWT_ACCESS_SECRET="your-ultra-secure-jwt-access-secret"
JWT_REFRESH_SECRET="your-ultra-secure-jwt-refresh-secret"
```

### 3. Initialize Database
```bash
cd server
npm install
npx prisma migrate deploy
```

### 4. Start the Application
In separate terminal windows:

```bash
# Terminal 1: Backend Server (Port 4000)
cd server
npm run dev

# Terminal 2: Frontend Web Client (Port 5173)
cd client
npm run dev
```

Visit [http://localhost:5173](http://localhost:5173) to access the web application or [http://localhost:4000/api-docs](http://localhost:4000/api-docs) to view Swagger API docs.

### 5. Run End-to-End Tests
```bash
cd client
npm run test:e2e
```

---

## 🧩 Browser Extension Setup

1. Open Google Chrome (or any Chromium browser like Brave, Edge).
2. Navigate to `chrome://extensions/`.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** and select the [`extension/`](extension/) directory from this repository.
5. Pin Vaultix to your browser toolbar to enable 1-click credential autofill and password generation!

---

## 🐳 Docker Deployment

To spin up the entire Vaultix ecosystem with PostgreSQL using Docker Compose:

```bash
docker compose up -d --build
```

Services initialized:
- `vaultix-postgres`: PostgreSQL database (Port `5432`)
- `vaultix-server`: Express backend API & Swagger (Port `4000`)
- `vaultix-client`: React + Vite frontend served via Nginx (Port `80`)

---

## 📁 Repository Directory Structure

```text
vaultix/
├── client/                     # React 19 + Vite Frontend Application
│   ├── e2e/                    # Playwright End-to-End Test Suites (40 tests)
│   ├── src/
│   │   ├── components/         # Shared UI components
│   │   ├── features/           # Redux Toolkit state slices
│   │   ├── mobile/             # Dedicated Mobile Native App Shell (<MobileRoot />)
│   │   │   ├── layout/         # Adaptive iOS/Android Tab Bar & App Shell
│   │   │   ├── screens/        # Auth, Vaults, Generator, Health, Settings
│   │   │   └── sheets/         # Item Detail Sheet, Item Editor Sheet, Trash
│   │   ├── pages/              # Desktop Web routing views
│   │   └── utils/              # WebCrypto, breach checking, clipboard, haptics
│   ├── capacitor.config.json   # Native iOS & Android build configuration
│   └── playwright.config.js    # Multi-device Playwright configuration
│
├── server/                     # Express 5 Backend API
│   ├── prisma/
│   │   ├── schema.prisma       # Database schema & relationships
│   │   └── migrations/         # PostgreSQL migration history
│   ├── src/
│   │   ├── controllers/        # Route controllers
│   │   ├── docs/               # Swagger OpenAPI 3.0 specification & theme
│   │   ├── middlewares/        # JWT auth, rate limiting, permissions
│   │   └── routes/             # REST endpoints (auth, vaults, passwords, etc.)
│   └── Dockerfile              # Production container build
│
├── extension/                  # Chrome Extension (Manifest V3)
│   ├── content/                # Real-time autofill & field detector scripts
│   ├── popup/                  # Extension browser action UI
│   └── background.js           # Extension background service worker
│
├── screenshots/                # Chrome Store & README visual assets
├── docker-compose.yml          # Multi-container orchestration
└── DEPLOY.md                   # Production deployment guide
```

---

## 🛡️ License

Proprietary © 2026 Vaultix Security. All rights reserved.
