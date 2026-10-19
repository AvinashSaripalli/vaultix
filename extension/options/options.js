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