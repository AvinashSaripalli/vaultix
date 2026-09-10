(() => {
  if (window.__vaultixLoaded) return;
  window.__vaultixLoaded = true;

  let badge = null;
  let menu = null;
  let activeField = null;
  let hideTimer = null;
  let autoOpenedFor = null;
  let suppressClickClose = false;

  document.addEventListener('focusin', onFocusIn, true);
  document.addEventListener('focusout', onFocusOut, true);
  document.addEventListener('click', onDocClick, true);
  window.addEventListener('scroll', reposition, true);
  window.addEventListener('resize', reposition);
  document.addEventListener('keydown', onKeydown, true);

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || msg.type !== 'VAULTIX_FILL') return;
    sendResponse({ ok: fillCredentials(msg.username, msg.password) });
  });

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
      loginEl.textContent = cred.login || '(no username)';
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
              { type: 'VAULTIX_LOG', passwordId: cred.id },
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
})();