(() => {
  if (window.__vaultixLoaded) return;
  window.__vaultixLoaded = true;

  // ─── State ───────────────────────────────────────────────────────────────
  let activeField = null;
  let currentCreds = [];
  let isVaultUnlocked = false;
  let overlayHost = null;
  let overlayShadow = null;
  let inFieldIcon = null;
  let inPageDropdown = null;
  let hideTimer = null;
  let autoOpenedFor = null;
  let suppressClickClose = false;
  let lastTypedUsername = '';
  let saveBannerHost = null;
  let highlightedIndex = -1;

  // Official Vaultix Brand SVG (Shield with Keyhole / Lock)
  const VAULTIX_SVG = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L3 6V11C3 16.55 6.84 21.74 12 23C17.16 21.74 21 16.55 21 11V6L12 2Z" fill="#4F46E5"/>
      <path d="M12 8C10.9 8 10 8.9 10 10C10 10.74 10.4 11.38 11 11.72V15C11 15.55 11.45 16 12 16C12.55 16 13 15.55 13 15V11.72C13.6 11.38 14 10.74 14 10C14 8.9 13.1 8 12 8Z" fill="#FFFFFF"/>
    </svg>
  `;

  // ─── Global Event Listeners ──────────────────────────────────────────────
  document.addEventListener('focusin', onFocusIn, true);
  document.addEventListener('focusout', onFocusOut, true);
  document.addEventListener('click', onDocClick, true);
  document.addEventListener('input', onInputTrack, true);
  document.addEventListener('submit', onFormSubmit, true);
  window.addEventListener('scroll', repositionOverlay, true);
  window.addEventListener('resize', repositionOverlay);
  document.addEventListener('keydown', onKeydown, true);

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg) return;
    if (msg.type === 'VAULTIX_FILL') {
      sendResponse({ ok: fillCredentials(msg.username, msg.password, msg) });
      return;
    }
    if (msg.type === 'VAULTIX_PROMPT_PENDING') {
      if (window === window.top) checkPendingLoginBanner();
      sendResponse({ ok: true });
    }
  });

  if (window === window.top) {
    setTimeout(checkPendingLoginBanner, 600);
  }

  // ─── Shadow DOM Overlay Root Setup ──────────────────────────────────────
  function ensureOverlayRoot() {
    if (overlayHost && document.contains(overlayHost)) return overlayShadow;
    overlayHost = document.createElement('div');
    overlayHost.id = 'vaultix-overlay-root';
    Object.assign(overlayHost.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '0',
      pointerEvents: 'none',
      zIndex: '2147483646',
      margin: '0',
      padding: '0',
      border: 'none',
    });
    overlayShadow = overlayHost.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = `
      * { box-sizing: border-box; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
      
      /* In-Field Brand Icon */
      .vaultix-field-icon {
        pointer-events: auto;
        position: absolute;
        width: 24px;
        height: 24px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        background: transparent;
        transition: transform 0.15s ease, background-color 0.15s ease;
        user-select: none;
      }
      .vaultix-field-icon:hover {
        transform: scale(1.1);
        background: rgba(79, 70, 229, 0.12);
      }
      .vaultix-field-icon svg {
        filter: drop-shadow(0 1px 2px rgba(0,0,0,0.2));
      }

      /* In-Page Dropdown Menu */
      .vaultix-dropdown {
        pointer-events: auto;
        position: absolute;
        width: 310px;
        max-height: 320px;
        background: #0f172a;
        color: #f8fafc;
        border: 1px solid #334155;
        border-radius: 12px;
        box-shadow: 0 16px 36px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(79, 70, 229, 0.3);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        font-size: 13px;
        animation: fadeIn 0.14s ease-out;
      }
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(-4px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .dropdown-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 9px 12px;
        background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
        border-bottom: 1px solid #334155;
      }
      .brand-title {
        display: flex;
        align-items: center;
        gap: 7px;
        font-weight: 700;
        font-size: 13px;
        color: #f8fafc;
      }
      .site-badge {
        font-size: 10.5px;
        font-weight: 500;
        color: #94a3b8;
        background: #1e293b;
        padding: 2px 6px;
        border-radius: 5px;
        border: 1px solid #334155;
      }

      .items-list {
        overflow-y: auto;
        padding: 4px;
        flex: 1;
      }
      .account-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 10px;
        border-radius: 8px;
        cursor: pointer;
        transition: background-color 0.12s ease;
      }
      .account-row:hover, .account-row.highlighted {
        background: #1e293b;
      }
      .account-avatar {
        width: 28px;
        height: 28px;
        border-radius: 7px;
        background: #4f46e5;
        color: #fff;
        font-weight: 700;
        font-size: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .account-info {
        flex: 1;
        min-width: 0;
      }
      .account-name {
        font-weight: 600;
        color: #f1f5f9;
        font-size: 12.5px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .account-login {
        font-size: 11px;
        color: #94a3b8;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin-top: 1px;
      }
      .account-vault {
        font-size: 10px;
        color: #818cf8;
        font-weight: 500;
      }

      .fill-badge {
        font-size: 11px;
        font-weight: 600;
        background: #4f46e5;
        color: #fff;
        padding: 3px 8px;
        border-radius: 6px;
        opacity: 0;
        transition: opacity 0.12s ease;
      }
      .account-row:hover .fill-badge, .account-row.highlighted .fill-badge {
        opacity: 1;
      }

      /* Locked / Empty states */
      .notice-box {
        padding: 16px 14px;
        text-align: center;
        color: #94a3b8;
      }
      .notice-box .notice-title {
        color: #f1f5f9;
        font-weight: 600;
        margin-bottom: 4px;
        font-size: 13px;
      }
      .notice-btn {
        margin-top: 10px;
        padding: 7px 12px;
        border-radius: 6px;
        border: none;
        background: #4f46e5;
        color: #fff;
        font-weight: 600;
        font-size: 12px;
        cursor: pointer;
      }
      .notice-btn:hover { background: #4338ca; }

      /* Footer Shortcuts */
      .dropdown-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 7px 10px;
        background: #0b1222;
        border-top: 1px solid #1e293b;
        font-size: 11px;
      }
      .footer-action {
        background: none;
        border: none;
        color: #818cf8;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        padding: 2px 4px;
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .footer-action:hover { color: #a5b4fc; text-decoration: underline; }
    `;
    overlayShadow.appendChild(style);
    document.documentElement.appendChild(overlayHost);
    return overlayShadow;
  }

  // ─── Fetch Cached Credentials ─────────────────────────────────────────────
  async function fetchCachedCreds() {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: 'VAULTIX_GET_CREDS' }, (resp) => {
          if (chrome.runtime.lastError || !resp) {
            resolve({ creds: [], unlocked: false });
            return;
          }
          resolve({
            creds: Array.isArray(resp.creds) ? resp.creds : [],
            unlocked: Boolean(resp.unlocked),
          });
        });
      } catch {
        resolve({ creds: [], unlocked: false });
      }
    });
  }

  // ─── Field Detection ──────────────────────────────────────────────────────
  function isVisible(el) {
    if (!el || !el.getClientRects().length) return false;
    const style = window.getComputedStyle(el);
    return (
      style.visibility !== 'hidden' &&
      style.display !== 'none' &&
      !el.disabled &&
      !el.readOnly
    );
  }

  function getFieldLabelText(el) {
    if (!el) return '';
    try {
      if (el.id) {
        const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (lbl) return (lbl.textContent || '').trim();
      }
      const parentLabel = el.closest('label');
      if (parentLabel) return (parentLabel.textContent || '').trim();

      const ariaId = el.getAttribute('aria-labelledby');
      if (ariaId) {
        const ariaEl = document.getElementById(ariaId);
        if (ariaEl) return (ariaEl.textContent || '').trim();
      }

      let prev = el.previousElementSibling;
      while (prev) {
        if (/label|span|div|p|b|strong/i.test(prev.tagName)) {
          const txt = (prev.textContent || '').trim();
          if (txt) return txt;
        }
        prev = prev.previousElementSibling;
      }
    } catch {
      /* ignore DOM query errors */
    }
    return '';
  }

  function isCaptchaOrOtpField(el) {
    if (!el || el.tagName !== 'INPUT') return false;

    const ac = (el.getAttribute('autocomplete') || '').toLowerCase();
    if (ac === 'one-time-code') return true;

    const type = (el.type || '').toLowerCase();
    if (['hidden', 'submit', 'button', 'checkbox', 'radio'].includes(type)) return true;

    const idName = `${el.id} ${el.name} ${el.placeholder || ''} ${el.getAttribute('aria-label') || ''} ${el.className || ''}`.toLowerCase();
    if (/captcha|cpatcha|captchacode|captcha_code|txtcaptcha|captchatext|captchainput|usercaptcha|imgcode|imagecode|mathcaptcha/i.test(idName)) {
      return true;
    }
    if (/\b(otp|totp|2fa|mfa|passcode|verification_code|verificationcode|verify_code|security_code|securitycode|challenge)\b/i.test(idName)) {
      return true;
    }

    const labelText = getFieldLabelText(el).toLowerCase();
    if (/captcha|cpatcha|security code|verification code|type the characters|enter code shown/i.test(labelText)) {
      return true;
    }

    try {
      const container = el.closest('tr, .form-group, .row, .col, div, fieldset, li') || el.parentElement;
      if (container) {
        const hasCaptchaImg = container.querySelector(
          'img[src*="captcha" i], img[id*="captcha" i], img[class*="captcha" i], canvas[id*="captcha" i]'
        );
        if (hasCaptchaImg) return true;
      }
    } catch {
      /* ignore */
    }
    return false;
  }

  function isUsernameField(el) {
    if (!el || el.tagName !== 'INPUT' || !isVisible(el)) return false;
    if (isCaptchaOrOtpField(el)) return false;

    const type = (el.type || '').toLowerCase();
    if (['password', 'hidden', 'submit', 'checkbox', 'radio'].includes(type)) return false;
    if (type === 'email' || type === 'tel') return true;
    if (type !== 'text' && type !== '') return false;

    const ac = (el.getAttribute('autocomplete') || '').toLowerCase();
    if (ac.includes('username') || ac.includes('email') || ac.includes('login')) return true;

    const idName = `${el.id} ${el.name} ${el.placeholder || ''} ${el.getAttribute('aria-label') || ''}`.toLowerCase();
    if (/user|login|email|account|customer|custid|netbanking|userid|member|fldlogin/i.test(idName)) return true;

    const labelText = getFieldLabelText(el).toLowerCase();
    if (/user|user\s*name|login|email|account|customer|cust\s*id|netbanking|user\s*id/i.test(labelText)) return true;

    return false;
  }

  function isCredField(el) {
    if (!el || el.tagName !== 'INPUT' || !isVisible(el)) return false;
    if (isCaptchaOrOtpField(el)) return false;

    const type = (el.type || '').toLowerCase();
    if (type === 'password' || type === 'email' || type === 'tel') return true;
    if (type !== 'text' && type !== '') return false;

    if (isUsernameField(el)) return true;

    const ac = (el.getAttribute('autocomplete') || '').toLowerCase();
    const nm = `${el.name} ${el.id} ${el.placeholder || ''}`.toLowerCase();
    if (ac.includes('cc-number') || /card|cc-number/i.test(nm)) return true;

    const form = el.form || el.closest('form, [role="dialog"], .modal') || null;
    const pw = form ? findPasswordInput(form) : findPasswordInput();
    if (pw && el !== pw && (el.compareDocumentPosition(pw) & Node.DOCUMENT_POSITION_FOLLOWING)) {
      if (!/search|query|find|filter/i.test(nm)) {
        return true;
      }
    }
    return false;
  }

  function findPasswordInput(within) {
    const scope = within || document;
    const candidates = [...scope.querySelectorAll('input[type="password"]')].filter(isVisible);
    return candidates[0] || null;
  }

  function findUsernameInput(pwField, within) {
    const scope = within || (pwField ? pwField.closest('form, [role="dialog"], .modal') : null) || document;
    const inputs = [
      ...scope.querySelectorAll(
        'input[type="text"], input[type="email"], input[type="tel"], input:not([type])'
      ),
    ].filter((el) => isVisible(el) && !isCaptchaOrOtpField(el));

    if (!inputs.length) return null;
    const explicit = inputs.find(isUsernameField);
    if (explicit) return explicit;

    if (pwField) {
      let preceding = null;
      for (const el of inputs) {
        if (el.compareDocumentPosition(pwField) & Node.DOCUMENT_POSITION_FOLLOWING) {
          preceding = el;
        }
      }
      if (preceding) return preceding;
    }
    return inputs[0] || null;
  }

  // ─── Autofill Execution ──────────────────────────────────────────────────
  function setNativeValue(el, value) {
    const proto =
      el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function fillCredentials(username, password, extra = {}) {
    const anchor = document.contains(activeField) ? activeField : null;
    const form = anchor?.form || anchor?.closest?.('form, [role="dialog"], .modal') || null;

    // Credit Card Autofill support
    if (extra?.cardData) {
      let filledAny = false;
      const { cardNumber, cardholderName, expiry, cvv } = extra.cardData;
      const scope = form || document;
      const inputs = [...scope.querySelectorAll('input')].filter(isVisible);

      for (const input of inputs) {
        const idName = `${input.name} ${input.id} ${input.getAttribute('autocomplete') || ''} ${input.placeholder || ''}`.toLowerCase();
        if (cardNumber && (/card.*number|cc.*num|pan|cardnum/i.test(idName) || input.getAttribute('autocomplete') === 'cc-number')) {
          setNativeValue(input, cardNumber);
          filledAny = true;
        } else if (cardholderName && (/card.*name|cardholder|cc.*name|name.*card/i.test(idName) || input.getAttribute('autocomplete') === 'cc-name')) {
          setNativeValue(input, cardholderName);
          filledAny = true;
        } else if (expiry && (/exp|expiry|mm\/yy/i.test(idName) || input.getAttribute('autocomplete') === 'cc-exp')) {
          setNativeValue(input, expiry);
          filledAny = true;
        } else if (cvv && (/cvv|cvc|security.*code|card.*code/i.test(idName) || input.getAttribute('autocomplete') === 'cc-csc')) {
          setNativeValue(input, cvv);
          filledAny = true;
        }
      }
      if (filledAny) {
        closeDropdown();
        removeFieldIcon();
        return true;
      }
    }

    let pwField = form ? findPasswordInput(form) : null;
    if (!pwField) pwField = findPasswordInput();

    let userField = null;
    if (anchor && anchor.type !== 'password' && !isCaptchaOrOtpField(anchor) && isUsernameField(anchor)) {
      userField = anchor;
    } else {
      userField = findUsernameInput(pwField, form) || findUsernameInput(pwField, document);
    }

    let didFill = false;
    if (userField && username) {
      setNativeValue(userField, username);
      didFill = true;
    }
    if (pwField && password) {
      setNativeValue(pwField, password);
      didFill = true;
    }

    // Fill Transaction Password if provided
    if (extra?.transactionPassword) {
      const scope = form || document;
      const pwCandidates = [...scope.querySelectorAll('input[type="password"]')].filter(isVisible);
      const transField = pwCandidates.find(p => p !== pwField || /trans|pin|secondary|profile/i.test(`${p.name} ${p.id}`));
      if (transField) {
        setNativeValue(transField, extra.transactionPassword);
        didFill = true;
      }
    }

    // Smart Focus: focus unfilled captcha if present
    const scope = form || document;
    const captchaField = [...scope.querySelectorAll('input')].find(
      (el) => isVisible(el) && isCaptchaOrOtpField(el)
    );
    if (captchaField && !captchaField.value) {
      captchaField.focus();
    } else if (pwField && !password) {
      pwField.focus();
    }

    closeDropdown();
    removeFieldIcon();
    return didFill;
  }

  // ─── Events ───────────────────────────────────────────────────────────────
  function onFocusIn(e) {
    const el = e.target;
    if (!isCredField(el)) {
      if (activeField && activeField !== el) {
        activeField = null;
        removeFieldIcon();
        closeDropdown();
      }
      return;
    }
    activeField = el;
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    setTimeout(() => renderInFieldIconAndDropdown(el), 60);
  }

  function onFocusOut(e) {
    if (e.target !== activeField) return;
    hideTimer = setTimeout(() => {
      removeFieldIcon();
      closeDropdown();
    }, 220);
  }

  function onDocClick(e) {
    checkSubmitButtonClick(e.target);
    if (e.target === activeField) return;
    if (overlayHost && overlayHost.contains(e.target)) {
      suppressClickClose = true;
      return;
    }
    if (suppressClickClose) {
      suppressClickClose = false;
      return;
    }
    closeDropdown();
  }

  function onKeydown(e) {
    if (e.key === 'Escape') {
      closeDropdown();
      return;
    }

    if (inPageDropdown && currentCreds.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        highlightedIndex = (highlightedIndex + 1) % currentCreds.length;
        updateHighlightedRow();
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        highlightedIndex = (highlightedIndex - 1 + currentCreds.length) % currentCreds.length;
        updateHighlightedRow();
        return;
      }
      if (e.key === 'Enter' && highlightedIndex >= 0) {
        e.preventDefault();
        const cred = currentCreds[highlightedIndex];
        if (cred) fillAndLog(cred);
        return;
      }
    }

    if (e.key === 'Enter') {
      const el = e.target;
      if (el && el.tagName === 'INPUT') {
        const form = el.form || el.closest('form');
        captureLoginFromScope(form || document);
      }
    }
  }

  function onInputTrack(e) {
    const el = e.target;
    if (!el || el.tagName !== 'INPUT') return;
    const type = (el.type || '').toLowerCase();
    if (type !== 'password' && isCredField(el)) {
      const val = (el.value || '').trim();
      if (val) lastTypedUsername = val;
    }
  }

  function onFormSubmit(e) {
    const form = e.target instanceof HTMLElement ? e.target : document;
    captureLoginFromScope(form);
  }

  function checkSubmitButtonClick(target) {
    if (!target || !(target instanceof Element)) return;
    const btn = target.closest(
      'button, input[type="submit"], input[type="button"], [role="button"], a[ class*="btn" ], a[ class*="button" ]'
    );
    if (!btn) return;

    const type = (btn.getAttribute('type') || '').toLowerCase();
    const label = (
      btn.textContent ||
      btn.getAttribute('value') ||
      btn.getAttribute('aria-label') ||
      ''
    ).trim().toLowerCase();

    const isLikelySubmit =
      type === 'submit' ||
      /log\s*in|sign\s*in|continue|submit|next|sign\s*up|register|create|verify|unlock|enter|save|change\s*password|update\s*password|join/i.test(label);

    if (!isLikelySubmit) return;
    const form = btn.closest('form') || document;
    captureLoginFromScope(form);
  }

  function cleanSiteName() {
    const h = (location.hostname || '').replace(
      /^(www|auth|login|signin|account|accounts|my|app|portal|hpanel)\./i,
      ''
    );
    const first = h.split('.')[0] || location.hostname || 'Website';
    return first.charAt(0).toUpperCase() + first.slice(1);
  }

  // ─── Intelligent Password & Username Detection (Login, Register, Update) ──
  function detectFormCredentialFields(scope) {
    const pwFields = [...(scope || document).querySelectorAll('input[type="password"]')].filter(isVisible);
    if (!pwFields.length) return null;

    // 1. Check for Change Password (Old + New + Confirm)
    const oldField = pwFields.find(p => {
      const nm = `${p.name} ${p.id} ${p.placeholder || ''} ${p.getAttribute('autocomplete') || ''}`.toLowerCase();
      return /current|old|previous|existing/i.test(nm);
    });

    const newField = pwFields.find(p => {
      if (p === oldField) return false;
      const nm = `${p.name} ${p.id} ${p.placeholder || ''} ${p.getAttribute('autocomplete') || ''}`.toLowerCase();
      return /new|create|choose|set/i.test(nm) || p.getAttribute('autocomplete') === 'new-password';
    });

    const confirmField = pwFields.find(p => {
      if (p === oldField || p === newField) return false;
      const nm = `${p.name} ${p.id} ${p.placeholder || ''}`.toLowerCase();
      return /confirm|repeat|verify|retype|re-enter/i.test(nm);
    });

    if (oldField && newField) {
      return {
        isChangePassword: true,
        isRegistration: false,
        password: newField.value,
        pwField: newField,
      };
    }

    // 2. Check for Registration Form (New password + Confirm or Register URL)
    const isRegisterUrl = /register|signup|sign-up|join|create-account|new-user/i.test(location.href);
    const hasNewPwAttr = pwFields.some(p => p.getAttribute('autocomplete') === 'new-password');
    const hasConfirm = !!confirmField;

    if (isRegisterUrl || hasNewPwAttr || (hasConfirm && pwFields.length >= 2)) {
      const targetPw = newField || pwFields.find(p => p !== confirmField) || pwFields[0];
      return {
        isChangePassword: false,
        isRegistration: true,
        password: targetPw ? targetPw.value : '',
        pwField: targetPw,
      };
    }

    // 3. Standard Login Form
    return {
      isChangePassword: false,
      isRegistration: false,
      password: pwFields[0].value,
      pwField: pwFields[0],
    };
  }

  function captureLoginFromScope(scope) {
    const detection = detectFormCredentialFields(scope);
    if (!detection || !detection.password) return;

    const password = detection.password;
    let username = '';

    const userField = findUsernameInput(detection.pwField, scope) || findUsernameInput(detection.pwField, document);
    if (userField && userField.value && userField.value.trim()) {
      username = userField.value.trim();
    } else if (lastTypedUsername) {
      username = lastTypedUsername;
    } else {
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
      const formContainer = detection.pwField.closest('form, main, [role="main"], body') || document.body;
      const textMatch = (formContainer?.innerText || '').match(emailRegex);
      if (textMatch) username = textMatch[0];
    }

    const isVaultixOwnApp =
      document.title.toLowerCase().includes('vaultix') &&
      !!document.querySelector('#root');

    try {
      chrome.runtime.sendMessage(
        {
          type: 'VAULTIX_CAPTURE_LOGIN',
          url: location.origin,
          sourceUrl: location.href,
          hostname: location.hostname.replace(/^www\./, ''),
          title: cleanSiteName(),
          username,
          password,
          isRegistration: detection.isRegistration,
          isVaultixOwnApp,
        },
        (resp) => {
          void chrome.runtime.lastError;
          if (resp && resp.ok && (resp.status === 'NEW' || resp.status === 'UPDATE')) {
            watchForSpaLoginSuccess();
          }
        }
      );
    } catch {
      /* ignore */
    }
  }

  let spaLoginWatcher = null;
  function watchForSpaLoginSuccess() {
    if (spaLoginWatcher) clearInterval(spaLoginWatcher);
    const initialUrl = location.href;
    let checks = 0;
    spaLoginWatcher = setInterval(() => {
      checks++;
      const urlChanged = location.href !== initialUrl;
      const pwField = findPasswordInput(document);

      // Trigger condition: URL changed OR password field removed from DOM OR user registered
      if (urlChanged || !pwField || checks >= 6) {
        clearInterval(spaLoginWatcher);
        spaLoginWatcher = null;
        setTimeout(() => {
          if (window === window.top) checkPendingLoginBanner();
        }, 500);
        return;
      }

      if (checks >= 25) {
        clearInterval(spaLoginWatcher);
        spaLoginWatcher = null;
      }
    }, 400);
  }

  // ─── In-Page Autofill Overlay (In-Field Icon + Dropdown) ───────────────────
  function removeFieldIcon() {
    if (inFieldIcon) {
      inFieldIcon.remove();
      inFieldIcon = null;
    }
  }

  function closeDropdown() {
    if (inPageDropdown) {
      inPageDropdown.remove();
      inPageDropdown = null;
      highlightedIndex = -1;
    }
  }

  function repositionOverlay() {
    if (!activeField || !document.contains(activeField)) {
      removeFieldIcon();
      closeDropdown();
      return;
    }
    positionInFieldIcon();
    if (inPageDropdown) positionDropdown();
  }

  function positionInFieldIcon() {
    if (!inFieldIcon || !activeField) return;
    const r = activeField.getBoundingClientRect();
    const iconSize = 22;
    inFieldIcon.style.top = `${r.top + window.scrollY + (r.height - iconSize) / 2}px`;
    inFieldIcon.style.left = `${r.right + window.scrollX - iconSize - 7}px`;
  }

  function positionDropdown() {
    if (!inPageDropdown || !activeField) return;
    const r = activeField.getBoundingClientRect();
    const dropdownRect = inPageDropdown.getBoundingClientRect();
    const menuTop = r.bottom + window.scrollY + 6;
    const viewportBottom = window.scrollY + window.innerHeight - 12;

    const top =
      menuTop + dropdownRect.height > viewportBottom
        ? r.top + window.scrollY - dropdownRect.height - 6
        : menuTop;

    const left = Math.max(8, Math.min(r.left + window.scrollX, window.scrollX + window.innerWidth - 320));
    inPageDropdown.style.top = `${Math.max(8, top)}px`;
    inPageDropdown.style.left = `${left}px`;
  }

  async function renderInFieldIconAndDropdown(fieldEl) {
    if (fieldEl !== activeField) return;
    const { creds, unlocked } = await fetchCachedCreds();
    if (fieldEl !== activeField) return;

    currentCreds = creds;
    isVaultUnlocked = unlocked;

    const shadow = ensureOverlayRoot();

    // 1. Create In-Field Icon Badge
    if (!inFieldIcon) {
      inFieldIcon = document.createElement('div');
      inFieldIcon.className = 'vaultix-field-icon';
      inFieldIcon.innerHTML = VAULTIX_SVG;
      inFieldIcon.title = unlocked
        ? `Vaultix Autofill — ${creds.length} login(s) available`
        : 'Vaultix — Click to unlock';

      inFieldIcon.addEventListener('mousedown', (e) => e.preventDefault());
      inFieldIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        if (inPageDropdown) {
          closeDropdown();
        } else {
          openDropdown(creds, unlocked);
        }
      });

      shadow.appendChild(inFieldIcon);
      positionInFieldIcon();
    }

    // Auto-open on focus if matching credentials exist
    if (autoOpenedFor !== fieldEl && creds.length > 0 && unlocked) {
      autoOpenedFor = fieldEl;
      openDropdown(creds, unlocked);
    }
  }

  function openDropdown(creds, unlocked) {
    closeDropdown();
    const shadow = ensureOverlayRoot();

    inPageDropdown = document.createElement('div');
    inPageDropdown.className = 'vaultix-dropdown';

    const header = document.createElement('div');
    header.className = 'dropdown-header';
    header.innerHTML = `
      <div class="brand-title">
        ${VAULTIX_SVG}
        <span>Vaultix</span>
      </div>
      <div class="site-badge">${cleanSiteName()}</div>
    `;
    inPageDropdown.appendChild(header);

    // Case A: Vault is Locked
    if (!unlocked) {
      const lockBox = document.createElement('div');
      lockBox.className = 'notice-box';
      lockBox.innerHTML = `
        <div class="notice-title">🔒 Vault is Locked</div>
        <div style="font-size:11.5px;color:#94a3b8;line-height:1.4;">Unlock Vaultix to autofill credentials for this website.</div>
        <button class="notice-btn" type="button">Unlock Vaultix</button>
      `;
      lockBox.querySelector('.notice-btn').addEventListener('click', () => {
        closeDropdown();
        try {
          chrome.runtime.sendMessage({ type: 'VAULTIX_OPEN_POPUP' });
        } catch {
          /* ignore */
        }
      });
      inPageDropdown.appendChild(lockBox);
    }
    // Case B: No Matching Credentials
    else if (!creds.length) {
      const emptyBox = document.createElement('div');
      emptyBox.className = 'notice-box';
      emptyBox.innerHTML = `
        <div class="notice-title">No saved logins</div>
        <div style="font-size:11.5px;color:#94a3b8;line-height:1.4;">No logins saved for ${location.hostname}.</div>
        <button class="notice-btn" type="button">🔑 Generate Strong Password</button>
      `;
      emptyBox.querySelector('.notice-btn').addEventListener('click', () => {
        applyGeneratedPassword();
      });
      inPageDropdown.appendChild(emptyBox);
    }
    // Case C: Display Matching Credentials (1-Click Fill)
    else {
      const list = document.createElement('div');
      list.className = 'items-list';

      creds.slice(0, 8).forEach((cred, index) => {
        const row = document.createElement('div');
        row.className = 'account-row';
        row.dataset.index = index;

        const initial = (cred.name || cred.login || 'V').charAt(0).toUpperCase();
        const folderTag = cred.shared
          ? `🏢 ${cred.vaultName || 'Company'}`
          : (cred.folderName ? `📁 ${cred.folderName}` : '🔒 Personal');

        row.innerHTML = `
          <div class="account-avatar">${initial}</div>
          <div class="account-info">
            <div class="account-name">${escapeHtml(cred.name)}</div>
            <div class="account-login">${escapeHtml(cred.login || '(no username)')}</div>
            <div class="account-vault">${folderTag}</div>
          </div>
          <div class="fill-badge">Fill</div>
        `;

        row.addEventListener('click', (e) => {
          e.stopPropagation();
          fillAndLog(cred);
        });

        list.appendChild(row);
      });
      inPageDropdown.appendChild(list);
    }

    // Footer actions
    const footer = document.createElement('div');
    footer.className = 'dropdown-footer';
    footer.innerHTML = `
      <button class="footer-action gen-pwd" type="button">🔑 Generate Password</button>
      <button class="footer-action open-vtx" type="button">Open Vaultix ↗</button>
    `;

    footer.querySelector('.gen-pwd').addEventListener('click', (e) => {
      e.stopPropagation();
      applyGeneratedPassword();
    });

    footer.querySelector('.open-vtx').addEventListener('click', (e) => {
      e.stopPropagation();
      closeDropdown();
      try {
        chrome.runtime.sendMessage({ type: 'VAULTIX_OPEN_POPUP' });
      } catch {
        /* ignore */
      }
    });

    inPageDropdown.appendChild(footer);
    shadow.appendChild(inPageDropdown);
    positionDropdown();
  }

  function updateHighlightedRow() {
    if (!inPageDropdown) return;
    const rows = inPageDropdown.querySelectorAll('.account-row');
    rows.forEach((r, idx) => {
      if (idx === highlightedIndex) {
        r.classList.add('highlighted');
        r.scrollIntoView({ block: 'nearest' });
      } else {
        r.classList.remove('highlighted');
      }
    });
  }

  function fillAndLog(cred) {
    const filled = fillCredentials(cred.login, cred.password);
    if (filled) {
      try {
        chrome.runtime.sendMessage({
          type: 'VAULTIX_LOG',
          passwordId: cred.id,
          action: 'autofill',
          domain: window.location.hostname,
          url: window.location.href,
        });
      } catch {
        /* best-effort logging */
      }
    }
  }

  function applyGeneratedPassword() {
    const pwd = generateSecurePassword(16);
    const pwInput = findPasswordInput(activeField?.form || document);
    if (pwInput) {
      setNativeValue(pwInput, pwd);
      pwInput.focus();
    }
    try {
      navigator.clipboard.writeText(pwd);
    } catch {
      /* ignore */
    }
    closeDropdown();
  }

  function generateSecurePassword(length = 16) {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnopqrstuvwxyz';
    const digits = '23456789';
    const symbols = '!@#$%^&*()-_=+';
    const all = upper + lower + digits + symbols;
    const array = new Uint32Array(length);
    crypto.getRandomValues(array);
    let pwd = [
      upper[array[0] % upper.length],
      lower[array[1] % lower.length],
      digits[array[2] % digits.length],
      symbols[array[3] % symbols.length],
    ];
    for (let i = 4; i < length; i++) {
      pwd.push(all[array[i] % all.length]);
    }
    return pwd.sort(() => crypto.getRandomValues(new Uint32Array(1))[0] - 0.5).join('');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ─── Auto-Save & Update Prompts (Shadow DOM Top-Right Banner) ─────────────
  function isTwoFactorPage() {
    const path = (location.pathname || '').toLowerCase();
    const search = (location.search || '').toLowerCase();
    const title = (document.title || '').toLowerCase();
    const combined = path + ' ' + search + ' ' + title;

    const tfaPattern = /(2fa|two[-_]?factor|mfa|otp|verify|verification|challenge|security[-_]?check|checkpoint|authenticator)/i;
    if (tfaPattern.test(combined)) return true;

    const otpInput = document.querySelector(
      'input[autocomplete="one-time-code"], input[name*="otp" i], input[name*="code" i], input[name*="token" i], input[name*="2fa" i]'
    );
    if (otpInput && isVisible(otpInput)) return true;
    return false;
  }

  function isLikelyLoginPage(pending) {
    // If user was registering or changing password, ALWAYS prompt regardless of URL
    if (pending?.isRegistration || pending?.mode === 'UPDATE') {
      return false;
    }

    const path = (location.pathname || '').toLowerCase();
    const search = (location.search || '').toLowerCase();
    const combined = path + ' ' + search;
    const loginPatterns = /(login|sign[-_]?in|log[-_]?in|auth|authenticate|session|oauth|sso)/i;

    let isSameSource = false;
    if (pending?.sourcePath && pending.sourcePath.length > 1) {
      isSameSource = path === pending.sourcePath.toLowerCase();
    }
    const hasVisiblePw = !!findPasswordInput(document);
    return hasVisiblePw && (loginPatterns.test(combined) || isSameSource);
  }

  function checkPendingLoginBanner() {
    if (window !== window.top) return;
    try {
      chrome.runtime.sendMessage(
        { type: 'VAULTIX_CHECK_PENDING_LOGIN', tabUrl: location.href },
        (resp) => {
          if (chrome.runtime.lastError || !resp || !resp.ok || !resp.pending) {
            return;
          }

          if (isTwoFactorPage()) {
            try {
              chrome.runtime.sendMessage({ type: 'VAULTIX_RESET_PROMPTED' });
            } catch {
              /* ignore */
            }
            return;
          }

          if (isLikelyLoginPage(resp.pending)) {
            try {
              chrome.runtime.sendMessage({ type: 'VAULTIX_RESET_PROMPTED' });
            } catch {
              /* ignore */
            }
            return;
          }

          renderSaveBanner(resp);
        }
      );
    } catch {
      /* ignore */
    }
  }

  function closeSaveBanner() {
    if (saveBannerHost) {
      saveBannerHost.remove();
      saveBannerHost = null;
    }
  }

  function renderSaveBanner(data) {
    const {
      pending,
      signedIn,
      unlocked,
      folders = [],
      companyVaults = [],
      defaultFolderName = 'Saved from Browser',
    } = data;

    if (!pending || !signedIn) return;
    closeSaveBanner();

    saveBannerHost = document.createElement('div');
    saveBannerHost.id = 'vaultix-save-banner-host';
    Object.assign(saveBannerHost.style, {
      position: 'fixed',
      top: '16px',
      right: '16px',
      zIndex: '2147483647',
      margin: '0',
      padding: '0',
      border: 'none',
      background: 'transparent',
    });

    const shadow = saveBannerHost.attachShadow({ mode: 'closed' });
    const isUpdate = pending.mode === 'UPDATE';

    const style = document.createElement('style');
    style.textContent = `
      * { box-sizing: border-box; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
      .card {
        width: 340px;
        background: #0f172a;
        color: #f8fafc;
        border: 1px solid #334155;
        border-radius: 14px;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(79, 70, 229, 0.35);
        overflow: hidden;
        animation: slideIn 0.22s cubic-bezier(0.16, 1, 0.3, 1);
      }
      @keyframes slideIn {
        from { opacity: 0; transform: translateY(-12px) scale(0.97); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      .header {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 14px;
        background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
        border-bottom: 1px solid #1e293b;
      }
      .logo {
        width: 30px;
        height: 30px;
        border-radius: 8px;
        background: #4f46e5;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .title-wrap { flex: 1; min-width: 0; }
      .title {
        font-size: 13.5px;
        font-weight: 700;
        color: #f8fafc;
        line-height: 1.25;
      }
      .subtitle {
        font-size: 11px;
        color: #94a3b8;
        margin-top: 1px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .close-btn {
        background: transparent;
        border: none;
        color: #94a3b8;
        cursor: pointer;
        width: 26px;
        height: 26px;
        border-radius: 6px;
        font-size: 15px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .close-btn:hover { background: #334155; color: #fff; }
      .body { padding: 12px 14px; }
      .field { margin-bottom: 9px; }
      .label {
        display: block;
        font-size: 10.5px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.4px;
        color: #94a3b8;
        margin-bottom: 4px;
      }
      .input-wrap {
        position: relative;
        display: flex;
        align-items: center;
      }
      input, select {
        width: 100%;
        padding: 7.5px 10px;
        border-radius: 8px;
        border: 1px solid #334155;
        background: #1e293b;
        color: #f1f5f9;
        font-size: 12.5px;
        outline: none;
        transition: border-color 0.15s;
      }
      optgroup { background: #0f172a; color: #818cf8; font-weight: 700; }
      option { background: #1e293b; color: #f1f5f9; font-weight: 500; }
      input:focus, select:focus { border-color: #6366f1; }
      .pw-input { padding-right: 50px; }
      .toggle-btn {
        position: absolute;
        right: 6px;
        background: transparent;
        border: none;
        color: #818cf8;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        padding: 3px 6px;
        border-radius: 4px;
      }
      .toggle-btn:hover { background: rgba(99, 102, 241, 0.15); }
      .lock-box {
        background: rgba(245, 158, 11, 0.1);
        border: 1px solid rgba(245, 158, 11, 0.35);
        border-radius: 8px;
        padding: 8px 10px;
        margin-bottom: 9px;
      }
      .lock-box .label { color: #fbbf24; }
      .error {
        color: #f87171;
        font-size: 11.5px;
        margin-bottom: 8px;
        display: none;
      }
      .actions {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 10px;
      }
      .btn-primary {
        flex: 1;
        padding: 8.5px 12px;
        border-radius: 8px;
        border: none;
        background: #4f46e5;
        color: #fff;
        font-size: 12.5px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.15s;
      }
      .btn-primary:hover { background: #4338ca; }
      .btn-primary:disabled { opacity: 0.6; cursor: default; }
      .btn-secondary {
        padding: 8.5px 11px;
        border-radius: 8px;
        border: 1px solid #334155;
        background: transparent;
        color: #cbd5e1;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
      }
      .btn-secondary:hover { background: #1e293b; color: #fff; }
      .footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 7px 14px 10px;
        border-top: 1px solid #1e293b;
        font-size: 11px;
        color: #64748b;
      }
      .never-link {
        background: none;
        border: none;
        color: #64748b;
        font-size: 11px;
        cursor: pointer;
        padding: 0;
      }
      .never-link:hover { color: #94a3b8; text-decoration: underline; }
      .success-toast {
        padding: 16px 14px;
        text-align: center;
        color: #34d399;
        font-weight: 600;
        font-size: 13px;
      }
    `;

    const card = document.createElement('div');
    card.className = 'card';

    for (const evt of ['keydown', 'keyup', 'keypress', 'mousedown', 'click']) {
      card.addEventListener(evt, (e) => e.stopPropagation());
    }

    const promptTitle = isUpdate
      ? 'Update password in Vaultix?'
      : (pending.isRegistration ? 'Save new registration to Vaultix?' : 'Save login to Vaultix?');

    const header = document.createElement('div');
    header.className = 'header';
    header.innerHTML = `
      <div class="logo">${VAULTIX_SVG}</div>
      <div class="title-wrap">
        <div class="title">${promptTitle}</div>
        <div class="subtitle">${escapeHtml(pending.hostname)}</div>
      </div>
      <button class="close-btn" title="Dismiss">✕</button>
    `;

    const body = document.createElement('div');
    body.className = 'body';

    // Item Name
    const nameField = document.createElement('div');
    nameField.className = 'field';
    nameField.innerHTML = `<label class="label">Item Name</label>`;
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = pending.name || cleanSiteName();
    nameField.appendChild(nameInput);

    // Username
    const userField = document.createElement('div');
    userField.className = 'field';
    userField.innerHTML = `<label class="label">Username / Email</label>`;
    const userInput = document.createElement('input');
    userInput.type = 'text';
    userInput.value = pending.username || '';
    userInput.placeholder = 'username or email';
    userField.appendChild(userInput);

    // Password
    const pwField = document.createElement('div');
    pwField.className = 'field';
    pwField.innerHTML = `<label class="label">Password</label>`;
    const pwWrap = document.createElement('div');
    pwWrap.className = 'input-wrap';
    const pwInput = document.createElement('input');
    pwInput.type = 'password';
    pwInput.className = 'pw-input';
    pwInput.value = pending.password || '';
    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'toggle-btn';
    toggleBtn.textContent = 'Show';
    toggleBtn.addEventListener('click', () => {
      const show = pwInput.type === 'password';
      pwInput.type = show ? 'text' : 'password';
      toggleBtn.textContent = show ? 'Hide' : 'Show';
    });
    pwWrap.append(pwInput, toggleBtn);
    pwField.appendChild(pwWrap);

    // Vault & Folder Selector
    const folderField = document.createElement('div');
    folderField.className = 'field';
    folderField.innerHTML = `<label class="label">Vault & Folder</label>`;
    const folderSelect = document.createElement('select');

    // Personal Vault Group
    const personalGroup = document.createElement('optgroup');
    personalGroup.label = '🔒 Personal Vault (Private)';
    const existingDefault = folders.find(
      (f) => (f.name || '').trim().toLowerCase() === defaultFolderName.toLowerCase()
    );
    const defaultOpt = document.createElement('option');
    defaultOpt.value = `personal:${existingDefault ? existingDefault.id : '__DEFAULT_BROWSER_FOLDER__'}`;
    defaultOpt.textContent = `📁 ${defaultFolderName} (Default)`;
    personalGroup.appendChild(defaultOpt);

    for (const f of folders) {
      if (existingDefault && f.id === existingDefault.id) continue;
      const opt = document.createElement('option');
      opt.value = `personal:${f.id}`;
      opt.textContent = `📁 ${f.name}`;
      if (
        isUpdate &&
        pending.existingVaultType !== 'COMPANY' &&
        pending.existingFolderId &&
        f.id === pending.existingFolderId
      ) {
        opt.selected = true;
      }
      personalGroup.appendChild(opt);
    }

    const newPersonalOpt = document.createElement('option');
    newPersonalOpt.value = 'personal:__NEW_FOLDER__';
    newPersonalOpt.textContent = '＋ Create new Personal folder…';
    personalGroup.appendChild(newPersonalOpt);
    folderSelect.appendChild(personalGroup);

    // Company Vaults Group
    for (const cv of companyVaults) {
      const cvGroup = document.createElement('optgroup');
      cvGroup.label = `🏢 ${cv.name} (Company Vault — Shared)`;
      for (const f of cv.folders || []) {
        const opt = document.createElement('option');
        opt.value = `company:${cv.id}:${f.id}`;
        opt.textContent = `🏢 ${f.name}`;
        if (
          isUpdate &&
          pending.existingVaultType === 'COMPANY' &&
          pending.existingFolderId &&
          f.id === pending.existingFolderId
        ) {
          opt.selected = true;
        }
        cvGroup.appendChild(opt);
      }
      if (cvGroup.children.length > 0) {
        folderSelect.appendChild(cvGroup);
      }
    }

    const newFolderInput = document.createElement('input');
    newFolderInput.type = 'text';
    newFolderInput.placeholder = 'Enter new folder name…';
    newFolderInput.style.marginTop = '6px';
    newFolderInput.style.display = 'none';

    folderSelect.addEventListener('change', () => {
      const isNew = folderSelect.value.endsWith(':__NEW_FOLDER__');
      newFolderInput.style.display = isNew ? 'block' : 'none';
      if (isNew) newFolderInput.focus();
    });

    folderField.append(folderSelect, newFolderInput);

    // Locked Vault inline Master Password prompt
    let masterInput = null;
    const lockBox = document.createElement('div');
    lockBox.className = 'lock-box';
    lockBox.style.display = unlocked ? 'none' : 'block';
    lockBox.innerHTML = `<label class="label">🔒 Enter Master Password to Encrypt & Save</label>`;
    masterInput = document.createElement('input');
    masterInput.type = 'password';
    masterInput.placeholder = 'Master password';
    lockBox.appendChild(masterInput);

    const errorEl = document.createElement('div');
    errorEl.className = 'error';

    const actions = document.createElement('div');
    actions.className = 'actions';

    const notNowBtn = document.createElement('button');
    notNowBtn.type = 'button';
    notNowBtn.className = 'btn-secondary';
    notNowBtn.textContent = 'Not now';

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'btn-primary';
    saveBtn.textContent = isUpdate ? 'Update Password' : 'Save to Vaultix';

    actions.append(notNowBtn, saveBtn);
    body.append(nameField, userField, pwField, folderField, lockBox, errorEl, actions);

    const footer = document.createElement('div');
    footer.className = 'footer';
    const neverBtn = document.createElement('button');
    neverBtn.type = 'button';
    neverBtn.className = 'never-link';
    neverBtn.textContent = `Never save for ${pending.hostname}`;
    const zkBadge = document.createElement('span');
    zkBadge.textContent = '🛡️ Zero-Knowledge';
    footer.append(neverBtn, zkBadge);

    card.append(header, body, footer);
    shadow.append(style, card);
    document.documentElement.appendChild(saveBannerHost);

    const dismiss = (neverForSite = false) => {
      closeSaveBanner();
      try {
        chrome.runtime.sendMessage({
          type: 'VAULTIX_DISMISS_PENDING',
          neverForSite,
          hostname: pending.hostname,
        });
      } catch {
        /* ignore */
      }
    };

    header.querySelector('.close-btn').addEventListener('click', () => dismiss(false));
    notNowBtn.addEventListener('click', () => dismiss(false));
    neverBtn.addEventListener('click', () => dismiss(true));

    saveBtn.addEventListener('click', () => {
      errorEl.style.display = 'none';
      const rawChoice = folderSelect.value || 'personal:__DEFAULT_BROWSER_FOLDER__';
      const isNew = rawChoice.endsWith(':__NEW_FOLDER__');
      const customFolder = isNew ? newFolderInput.value.trim() : '';

      if (isNew && !customFolder) {
        errorEl.textContent = 'Please enter a name for the new folder.';
        errorEl.style.display = 'block';
        newFolderInput.focus();
        return;
      }

      let vaultType = 'PERSONAL';
      let companyVaultId = '';
      let targetFolderId = '';

      if (rawChoice.startsWith('company:')) {
        vaultType = 'COMPANY';
        const parts = rawChoice.split(':');
        companyVaultId = parts[1] || '';
        targetFolderId = parts[2] === '__NEW_FOLDER__' ? '' : parts[2] || '';
      } else {
        vaultType = 'PERSONAL';
        const parts = rawChoice.split(':');
        targetFolderId = parts[1] === '__NEW_FOLDER__' ? '' : parts[1] || '';
      }

      saveBtn.disabled = true;
      saveBtn.textContent = isUpdate ? 'Updating…' : 'Saving…';

      chrome.runtime.sendMessage(
        {
          type: 'VAULTIX_SAVE_LOGIN',
          mode: pending.mode,
          existingId: pending.existingId,
          name: nameInput.value.trim() || pending.name,
          username: userInput.value.trim(),
          password: pwInput.value,
          url: pending.url,
          hostname: pending.hostname,
          vaultType,
          companyVaultId,
          folderId: targetFolderId,
          newFolderName: customFolder,
          masterPassword: masterInput ? masterInput.value : '',
        },
        (resp) => {
          if (chrome.runtime.lastError || !resp || !resp.ok) {
            saveBtn.disabled = false;
            saveBtn.textContent = isUpdate ? 'Update Password' : 'Save to Vaultix';
            if (resp?.reason === 'LOCKED' || resp?.reason === 'INVALID_MASTER') {
              lockBox.style.display = 'block';
              masterInput?.focus();
            }
            errorEl.textContent = resp?.error || 'Could not save login. Please try again.';
            errorEl.style.display = 'block';
            return;
          }

          card.innerHTML = `<div class="success-toast">✓ ${isUpdate ? 'Updated' : 'Saved'} in 📁 "${resp.folderName || defaultFolderName}"</div>`;
          setTimeout(closeSaveBanner, 1600);
        }
      );
    });
  }
})();
