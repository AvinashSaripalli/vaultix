(() => {
  if (window.__vaultixLoaded) return;
  window.__vaultixLoaded = true;

  let badge = null;
  let menu = null;
  let activeField = null;
  let hideTimer = null;
  let autoOpenedFor = null;
  let suppressClickClose = false;
  let lastTypedUsername = '';
  let saveBannerHost = null;

  document.addEventListener('focusin', onFocusIn, true);
  document.addEventListener('focusout', onFocusOut, true);
  document.addEventListener('click', onDocClick, true);
  document.addEventListener('input', onInputTrack, true);
  document.addEventListener('submit', onFormSubmit, true);
  window.addEventListener('scroll', reposition, true);
  window.addEventListener('resize', reposition);
  document.addEventListener('keydown', onKeydown, true);

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg) return;
    if (msg.type === 'VAULTIX_FILL') {
      sendResponse({ ok: fillCredentials(msg.username, msg.password) });
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

  // ─── Credential source (host-filtered, from the background worker) ────────
  async function getCachedCreds() {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: 'VAULTIX_GET_CREDS' }, (resp) => {
          if (chrome.runtime.lastError || !resp || !Array.isArray(resp.creds)) {
            resolve([]);
            return;
          }
          resolve(resp.creds);
        });
      } catch {
        resolve([]);
      }
    });
  }

  // ─── Field detection ──────────────────────────────────────────────────────
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

  function isCredField(el) {
    if (!el || el.tagName !== 'INPUT' || !isVisible(el)) return false;
    const type = (el.type || '').toLowerCase();
    if (type === 'password' || type === 'email' || type === 'tel') return true;
    if (type !== 'text' && type !== '') return false;

    const form = el.form || el.closest('form');
    if (form && form.querySelector('input[type="password"]')) return true;

    const ac = (el.getAttribute('autocomplete') || '').toLowerCase();
    const nm = (el.name || el.id || '').toLowerCase();
    if (ac.includes('username') || ac.includes('email') || ac.includes('login')) return true;
    if (/user|login|email|account/.test(nm)) return true;
    return false;
  }

  function findPasswordInput(within) {
    const scope = within || document;
    const candidates = [...scope.querySelectorAll('input[type="password"]')].filter(
      isVisible
    );
    return candidates[0] || null;
  }

  function findUsernameInput(pwField, within) {
    const scope = within || document;
    const inputs = [
      ...scope.querySelectorAll(
        'input[type="text"], input[type="email"], input[type="tel"], input:not([type])'
      ),
    ].filter(isVisible);

    let best = null;
    for (const el of inputs) {
      if (el.compareDocumentPosition(pwField) & Node.DOCUMENT_POSITION_FOLLOWING) {
        best = el;
      }
    }
    return best;
  }

  // ─── Filling ──────────────────────────────────────────────────────────────
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

  function fillCredentials(username, password) {
    const anchor = document.contains(activeField) ? activeField : null;
    const form = anchor?.form || anchor?.closest?.('form') || null;

    let pwField = form ? findPasswordInput(form) : null;
    if (!pwField) pwField = findPasswordInput();
    if (!pwField) return false;

    let userField = null;
    if (anchor && anchor.type !== 'password' && isCredField(anchor)) {
      userField = anchor;
    } else {
      userField = findUsernameInput(pwField, form);
    }

    if (userField && username) setNativeValue(userField, username);
    setNativeValue(pwField, password);
    pwField.focus();
    closeMenu();
    removeBadge();
    return true;
  }

  // ─── Events ───────────────────────────────────────────────────────────────
  function onFocusIn(e) {
    const el = e.target;
    if (!isCredField(el)) return;
    activeField = el;
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    setTimeout(() => showBadgeAndMenu(el), 80);
  }

  function onFocusOut(e) {
    if (e.target !== activeField) return;
    hideTimer = setTimeout(() => {
      if (menu && menu.matches(':hover')) return;
      removeBadge();
    }, 180);
  }

  function onDocClick(e) {
    // Check if user clicked a login/submit button while a password field has a value
    checkSubmitButtonClick(e.target);

    if (e.target === activeField) return;
    if (badge && (badge === e.target || badge.contains(e.target))) {
      suppressClickClose = true;
      return;
    }
    if (menu && (menu === e.target || menu.contains(e.target))) {
      suppressClickClose = true;
      return;
    }
    if (suppressClickClose) {
      suppressClickClose = false;
      return;
    }
    closeMenu();
  }

  function onKeydown(e) {
    if (e.key === 'Escape') closeMenu();
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
    )
      .trim()
      .toLowerCase();

    const isLikelySubmit =
      type === 'submit' ||
      /log\s*in|sign\s*in|continue|submit|next|sign\s*up|register|create|verify|unlock|enter/i.test(
        label
      );

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

  function captureLoginFromScope(scope) {
    const pwField = findPasswordInput(scope) || findPasswordInput(document);
    if (!pwField || !pwField.value) return;

    const password = pwField.value;
    let username = '';

    const userField =
      findUsernameInput(pwField, scope) || findUsernameInput(pwField, document);
    if (userField && userField.value && userField.value.trim()) {
      username = userField.value.trim();
    } else if (lastTypedUsername) {
      username = lastTypedUsername;
    } else {
      // Fallback for 2-step login pages that show the email as plain text on the password step
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
      const formContainer = pwField.closest('form, main, [role="main"], body') || document.body;
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
          isVaultixOwnApp,
        },
        (resp) => {
          void chrome.runtime.lastError;
          if (resp && resp.ok && (resp.status === 'NEW' || resp.status === 'UPDATE')) {
            // Watch for successful login on SPA or modal transitions without showing banner on the login form
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

      // Successful login condition for SPA:
      // Either user navigated to another URL (e.g. /dashboard) OR the password field was removed from the DOM
      if (urlChanged || !pwField) {
        clearInterval(spaLoginWatcher);
        spaLoginWatcher = null;
        setTimeout(() => {
          if (window === window.top) checkPendingLoginBanner();
        }, 500);
        return;
      }

      // Max wait ~12 seconds (35 checks * 350ms = 12.2s). If user is still sitting on the login form, do not prompt.
      if (checks >= 35) {
        clearInterval(spaLoginWatcher);
        spaLoginWatcher = null;
      }
    }, 350);
  }

  function removeBadge() {
    badge?.remove();
    badge = null;
    if (menu) {
      menu.style.display = 'none';
      menu.remove();
      menu = null;
    }
  }

  function closeMenu() {
    menu?.remove();
    menu = null;
  }

  // ─── Positioning ──────────────────────────────────────────────────────────
  function reposition() {
    if (!badge || !activeField || !document.contains(activeField)) {
      if (activeField && !document.contains(activeField)) removeBadge();
      return;
    }
    positionBadge();
    if (menu) positionMenu();
  }

  function positionBadge() {
    const r = activeField.getBoundingClientRect();
    badge.style.top = `${r.top + window.scrollY + (r.height - 22) / 2}px`;
    badge.style.left = `${r.right + window.scrollX - 26}px`;
  }

  function positionMenu() {
    const r = activeField.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const menuTop = r.bottom + window.scrollY + 6;
    const viewportBottom = window.scrollY + window.innerHeight - 12;
    const top =
      menuTop + menuRect.height > viewportBottom
        ? r.top + window.scrollY - menuRect.height - 6
        : menuTop;
    const left = Math.max(8, r.right + window.scrollX - 280);
    menu.style.top = `${Math.max(8, top)}px`;
    menu.style.left = `${left}px`;
  }

  // ─── Badge + menu ─────────────────────────────────────────────────────────
  async function showBadgeAndMenu(fieldEl) {
    if (fieldEl !== activeField) return;
    const creds = await getCachedCreds();
    if (fieldEl !== activeField) return;
    if (!creds.length) return;

    if (!badge) {
      badge = document.createElement('div');
      badge.textContent = '🔑';
      badge.title = 'Vaultix — using ' + creds.length + ' saved login(s)';
      Object.assign(badge.style, {
        position: 'absolute',
        zIndex: '2147483646',
        width: '22px',
        height: '22px',
        borderRadius: '50%',
        background: '#4f46e5',
        color: '#fff',
        fontSize: '12px',
        lineHeight: '22px',
        textAlign: 'center',
        cursor: 'pointer',
        boxShadow: '0 1px 4px rgba(0,0,0,.4)',
        userSelect: 'none',
      });
      document.documentElement.appendChild(badge);
      positionBadge();
      badge.addEventListener('mousedown', (e) => e.preventDefault());
      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        if (menu) {
          closeMenu();
        } else {
          openMenu(creds);
        }
      });
    }

    // Auto-open the picker when a credential field is focused (like other
    // password managers), but not twice for the same field.
    if (autoOpenedFor !== fieldEl) {
      autoOpenedFor = fieldEl;
      openMenu(creds);
    }
  }

  function openMenu(creds) {
    closeMenu();

    const ordered = creds.slice(0, 30);

    menu = document.createElement('div');
    Object.assign(menu.style, {
      position: 'absolute',
      zIndex: '2147483647',
      width: '280px',
      maxHeight: '240px',
      overflowY: 'auto',
      background: '#1e293b',
      border: '1px solid #334155',
      borderRadius: '10px',
      boxShadow: '0 8px 24px rgba(0,0,0,.45)',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px',
      color: '#e2e8f0',
      padding: '4px',
    });

    const head = document.createElement('div');
    head.textContent = 'Vaultix — ' + (activeField?.tagName === 'INPUT' ? 'Choose an account' : 'Vaultix');
    Object.assign(head.style, {
      padding: '6px 10px',
      fontWeight: '700',
      color: '#818cf8',
      borderBottom: '1px solid #334155',
      marginBottom: '4px',
    });
    menu.appendChild(head);

    if (!ordered.length) {
      const empty = document.createElement('div');
      empty.textContent =
        'Nothing for this site. Unlock in the extension popup, or add this item to your vault.';
      Object.assign(empty.style, { padding: '10px', color: '#94a3b8' });
      menu.appendChild(empty);
    }

    for (const cred of ordered) {
      const row = document.createElement('div');
      Object.assign(row.style, {
        padding: '7px 10px',
        borderRadius: '7px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      });
      row.addEventListener('mouseenter', () => (row.style.background = '#334155'));
      row.addEventListener('mouseleave', () => (row.style.background = 'transparent'));

      const dot = document.createElement('span');
      dot.textContent = '●';
      dot.title = 'Matches this site';
      dot.style.color = '#818cf8';

      const textWrap = document.createElement('div');
      textWrap.style.cssText = 'flex:1;min-width:0;';
      const nameEl = document.createElement('div');
      nameEl.textContent = cred.name;
      nameEl.style.cssText =
        'font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
      const loginEl = document.createElement('div');
      const baseLogin = cred.login || '(no username)';
      loginEl.textContent = cred.folderName ? `${baseLogin} • 📁 ${cred.folderName}` : baseLogin;
      loginEl.style.cssText =
        'font-size:11px;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
      textWrap.append(nameEl, loginEl);

      row.append(dot, textWrap);
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        const filled = fillCredentials(cred.login, cred.password);
        if (filled) {
          try {
            chrome.runtime.sendMessage(
              { type: 'VAULTIX_LOG', passwordId: cred.id, action: 'autofill' },
              () => {
                void chrome.runtime.lastError;
              }
            );
          } catch {
            /* logging is best-effort */
          }
        }
      });
      menu.appendChild(row);
    }

    document.documentElement.appendChild(menu);
    positionMenu();
  }

  // ─── Top-Right Save / Update Login Banner (Shadow DOM) ───────────────────
  function isTwoFactorPage() {
    const path = (location.pathname || '').toLowerCase();
    const search = (location.search || '').toLowerCase();
    const title = (document.title || '').toLowerCase();
    const combined = path + ' ' + search + ' ' + title;

    const tfaPattern = /(2fa|two[-_]?factor|mfa|otp|verify|verification|challenge|security[-_]?check|checkpoint|authenticator)/i;
    if (tfaPattern.test(combined)) return true;

    // Check for OTP/2FA inputs
    const otpInput = document.querySelector(
      'input[autocomplete="one-time-code"], input[name*="otp" i], input[name*="code" i], input[name*="token" i], input[name*="2fa" i], input[id*="otp" i], input[id*="2fa" i], input[id*="code" i]'
    );
    if (otpInput && isVisible(otpInput)) return true;

    return false;
  }

  function isLikelyLoginPage(pending) {
    const path = (location.pathname || '').toLowerCase();
    const search = (location.search || '').toLowerCase();
    const combined = path + ' ' + search;

    const loginPatterns = /(login|sign[-_]?in|log[-_]?in|auth|authenticate|session|oauth|sso)/i;

    let isSameSource = false;
    if (pending?.sourcePath && pending.sourcePath.length > 1) {
      isSameSource = path === pending.sourcePath.toLowerCase();
    }

    const hasVisiblePw = !!findPasswordInput(document);

    // If there is an active/visible password input and it's a login URL or the same source login URL,
    // the user is still on the login form (login hasn't completed or failed).
    return hasVisiblePw && (loginPatterns.test(combined) || isSameSource);
  }

  let twoFactorWatcher = null;
  function watchForTwoFactorSuccess() {
    if (twoFactorWatcher) clearInterval(twoFactorWatcher);
    const initialUrl = location.href;
    let checks = 0;
    twoFactorWatcher = setInterval(() => {
      checks++;
      const urlChanged = location.href !== initialUrl;
      const still2fa = isTwoFactorPage();
      if (urlChanged || !still2fa) {
        clearInterval(twoFactorWatcher);
        twoFactorWatcher = null;
        setTimeout(() => {
          if (window === window.top) checkPendingLoginBanner();
        }, 600);
        return;
      }
      if (checks >= 60) {
        clearInterval(twoFactorWatcher);
        twoFactorWatcher = null;
      }
    }, 500);
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

          // 1. If user is currently on a 2FA/MFA challenge, wait until 2FA completes
          if (isTwoFactorPage()) {
            try {
              chrome.runtime.sendMessage({ type: 'VAULTIX_RESET_PROMPTED' });
            } catch {
              /* ignore */
            }
            watchForTwoFactorSuccess();
            return;
          }

          // 2. If user is still on the login form with visible password input,
          // login has not succeeded yet (or failed with an error on the login page).
          if (isLikelyLoginPage(resp.pending)) {
            try {
              chrome.runtime.sendMessage({ type: 'VAULTIX_RESET_PROMPTED' });
            } catch {
              /* ignore */
            }
            return;
          }

          // 3. User has successfully logged in (redirected or login modal dismissed)!
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
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(79, 70, 229, 0.25);
        overflow: hidden;
        animation: slideIn 0.22s cubic-bezier(0.16, 1, 0.3, 1);
      }
      @keyframes slideIn {
        from { opacity: 0; transform: translateY(-10px) scale(0.98); }
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
        width: 28px;
        height: 28px;
        border-radius: 8px;
        background: #4f46e5;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        flex-shrink: 0;
        box-shadow: 0 2px 8px rgba(79, 70, 229, 0.45);
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
      optgroup {
        background: #0f172a;
        color: #818cf8;
        font-weight: 700;
      }
      option {
        background: #1e293b;
        color: #f1f5f9;
        font-weight: 500;
      }
      input:focus, select:focus { border-color: #6366f1; }
      .pw-input { padding-right: 48px; }
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
        text-decoration: none;
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

    const header = document.createElement('div');
    header.className = 'header';
    header.innerHTML = `
      <div class="logo">🔑</div>
      <div class="title-wrap">
        <div class="title">${isUpdate ? 'Update password in Vaultix?' : 'Save login to Vaultix?'}</div>
        <div class="subtitle">${pending.hostname}</div>
      </div>
      <button class="close-btn" title="Dismiss">✕</button>
    `;

    const body = document.createElement('div');
    body.className = 'body';

    // Name Field
    const nameField = document.createElement('div');
    nameField.className = 'field';
    nameField.innerHTML = `<label class="label">Item Name</label>`;
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = pending.name || cleanSiteName();
    nameField.appendChild(nameInput);

    // Username Field
    const userField = document.createElement('div');
    userField.className = 'field';
    userField.innerHTML = `<label class="label">Username / Email</label>`;
    const userInput = document.createElement('input');
    userInput.type = 'text';
    userInput.value = pending.username || '';
    userInput.placeholder = 'username or email';
    userField.appendChild(userInput);

    // Password Field
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

    // Vault & Folder Selector Dropdown (Personal Vault + Company Vaults)
    const folderField = document.createElement('div');
    folderField.className = 'field';
    folderField.innerHTML = `<label class="label">Vault & Folder</label>`;
    const folderSelect = document.createElement('select');

    // Group 1: Personal Vault
    const personalGroup = document.createElement('optgroup');
    personalGroup.label = '🔒 Personal Vault (Private to you)';

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

    // Group 2: Company Vaults (Shared with team)
    for (const cv of companyVaults) {
      const cvGroup = document.createElement('optgroup');
      cvGroup.label = `🏢 ${cv.name} (Company Vault — Shared)`;

      for (const f of cv.folders || []) {
        const opt = document.createElement('option');
        opt.value = `company:${cv.id}:${f.id}`;
        opt.textContent = `🏢 ${f.name}`;
        const isTarget =
          (isUpdate &&
            pending.existingVaultType === 'COMPANY' &&
            pending.existingFolderId &&
            f.id === pending.existingFolderId) ||
          (!isUpdate &&
            pending.suggestedVaultType === 'COMPANY' &&
            pending.suggestedFolderId &&
            f.id === pending.suggestedFolderId);
        if (isTarget) {
          opt.selected = true;
        }
        cvGroup.appendChild(opt);
      }

      if (cv.canCreateFolder) {
        const newCvOpt = document.createElement('option');
        newCvOpt.value = `company:${cv.id}:__NEW_FOLDER__`;
        newCvOpt.textContent = `＋ Create new folder in ${cv.name}…`;
        cvGroup.appendChild(newCvOpt);
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

    // Master password box if vault is currently locked
    let masterInput = null;
    const lockBox = document.createElement('div');
    lockBox.className = 'lock-box';
    lockBox.style.display = unlocked ? 'none' : 'block';
    lockBox.innerHTML = `<label class="label">🔒 Vault Locked — Enter Master Password</label>`;
    masterInput = document.createElement('input');
    masterInput.type = 'password';
    masterInput.placeholder = 'Master password to encrypt & save';
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
            errorEl.textContent =
              resp?.error || 'Could not save login. Please try again.';
            errorEl.style.display = 'block';
            return;
          }

          card.innerHTML = `<div class="success-toast">✓ ${
            isUpdate ? 'Updated' : 'Saved'
          } in 📁 "${resp.folderName || defaultFolderName}"</div>`;
          setTimeout(closeSaveBanner, 1600);
        }
      );
    });
  }
})();