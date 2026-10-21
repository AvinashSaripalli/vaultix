# Privacy Policy for Vaultix & Vaultix Chrome Extension

**Last Updated:** October 2026

Vaultix ("we", "our", or "us") provides a zero-knowledge password management solution and companion browser extension. We respect your privacy and are committed to protecting any personal data and credentials you manage through Vaultix.

---

## 1. Single Purpose & Scope
The **Vaultix Chrome Extension** exists for the sole purpose of securely managing, retrieving, and autofilling login credentials (usernames and passwords) saved in your personal, shared, or company vaults directly on web pages you visit.

---

## 2. Information We Handle
- **Authentication Information (Credentials)**: Usernames, emails, and passwords that you explicitly save in your Vaultix account. All sensitive credentials are encrypted using industry-standard client-side encryption before transmission and storage.
- **Local Browser Storage**: Encrypted authentication tokens, session state, and local settings (e.g., auto-lock duration) stored securely in your browser's local extension storage.

### What We Do NOT Collect:
- **No Browsing History**: We do not track, record, or store the web pages you visit.
- **No Keystroke Logging**: The extension does not record user keystrokes outside of explicitly authorized credential autofill.
- **No Third-Party Analytics / Tracking**: We do not use third-party trackers, ad networks, or telemetry scripts in the extension.
- **No Sale of User Data**: We never sell, rent, or transfer user data to third parties.

---

## 3. Chrome Extension Permissions Justification
- `storage`: Used solely to store encrypted authentication session tokens and user preference flags locally in the browser using the `chrome.storage.local` API.
- `tabs`: Used to query the URL and domain of the currently active tab strictly to display matching saved credentials for that website.
- `host_permissions` (`http://*/*`, `https://*/*`): Required to inject the autofill helper into login forms and autofill credentials into form fields upon user confirmation.

---

## 4. Remote Code Declaration
The Vaultix extension does **not** download or execute any remote code. All JavaScript, HTML, and assets are packaged directly within the local extension bundle compliant with Manifest V3.

---

## 5. Contact Information
If you have any questions regarding this Privacy Policy or Vaultix practices, please contact us at:  
**Email:** `karnipuna.integrations@gmail.com`  
**GitHub:** [https://github.com/AvinashSaripalli/vaultix](https://github.com/AvinashSaripalli/vaultix)
