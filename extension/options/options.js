const input = document.getElementById('baseUrl');
const vaultTimeoutSelect = document.getElementById('vaultTimeout');
const status = document.getElementById('status');
const testBtn = document.getElementById('testBtn');

chrome.storage.sync.get('baseUrl', ({ baseUrl }) => {
  input.value = (baseUrl && baseUrl !== 'http://localhost:4000') ? baseUrl : 'https://vaultix.knadvisors.pro';
});

chrome.storage.local.get('vaultTimeout', ({ vaultTimeout }) => {
  if (vaultTimeout) {
    vaultTimeoutSelect.value = vaultTimeout;
  } else {
    chrome.storage.sync.get('vaultTimeout', (sync) => {
      vaultTimeoutSelect.value = sync?.vaultTimeout || '480';
    });
  }
});

document.getElementById('form').addEventListener('submit', (e) => {
  e.preventDefault();
  const url = (input.value.trim() || 'https://vaultix.knadvisors.pro').replace(/\/+$/, '');
  const timeoutVal = vaultTimeoutSelect.value;
  chrome.storage.sync.set({ baseUrl: url, vaultTimeout: timeoutVal }, () => {
    chrome.storage.local.set({ vaultTimeout: timeoutVal }, () => {
      status.textContent = 'Settings saved';
      setTimeout(() => (status.textContent = ''), 2000);
    });
  });
});

testBtn.addEventListener('click', async () => {
  const url = input.value.trim().replace(/\/+$/, '');
  testBtn.disabled = true;
  status.textContent = 'Testing…';
  try {
    const res = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(10000) });
    const data = await res.json();
    if (res.ok && data.message) {
      status.textContent = 'Connection OK';
    } else {
      throw new Error('Unexpected response');
    }
  } catch {
    status.textContent = 'Cannot reach server';
  } finally {
    testBtn.disabled = false;
    setTimeout(() => (status.textContent = ''), 3000);
  }
});

document.getElementById('version').textContent =
  chrome.runtime.getManifest().version;

const accountCard = document.getElementById('accountCard');
const accountUser = document.getElementById('accountUser');
const accountDesc = document.getElementById('accountDesc');
const btnLogoutOptions = document.getElementById('btnLogoutOptions');
const accountStatus = document.getElementById('accountStatus');

function updateAccountUI() {
  chrome.storage.local.get(['token', 'user'], ({ token, user }) => {
    if (token && user) {
      if (accountCard) accountCard.style.display = 'block';
      if (accountUser) accountUser.textContent = user.email || user.fullName || 'Signed in';
      if (accountDesc) accountDesc.innerHTML = `Signed in as <strong id="accountUser">${user.email || user.fullName || 'User'}</strong>`;
      if (btnLogoutOptions) btnLogoutOptions.style.display = 'inline-block';
    } else {
      if (accountDesc) accountDesc.textContent = 'Not currently signed in to Vaultix.';
      if (btnLogoutOptions) btnLogoutOptions.style.display = 'none';
    }
  });
}

updateAccountUI();

if (btnLogoutOptions) {
  btnLogoutOptions.addEventListener('click', async () => {
    btnLogoutOptions.disabled = true;
    accountStatus.textContent = 'Logging out…';
    try {
      try {
        await chrome.storage.session.remove(['master', 'cache', 'privKey', 'pendingLogin', 'vaultServer']);
      } catch {
        /* ignore session errors */
      }
      await chrome.storage.local.remove(['token', 'refreshToken', 'user']);
      accountStatus.textContent = 'Logged out successfully';
      updateAccountUI();
    } catch {
      accountStatus.textContent = 'Error logging out';
    } finally {
      btnLogoutOptions.disabled = false;
      setTimeout(() => {
        if (accountStatus) accountStatus.textContent = '';
      }, 3000);
    }
  });
}