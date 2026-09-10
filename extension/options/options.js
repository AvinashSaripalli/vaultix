const input = document.getElementById('baseUrl');
const status = document.getElementById('status');
const testBtn = document.getElementById('testBtn');

chrome.storage.sync.get('baseUrl', ({ baseUrl }) => {
  input.value = baseUrl || 'http://localhost:4000';
});

document.getElementById('form').addEventListener('submit', (e) => {
  e.preventDefault();
  const url = input.value.trim().replace(/\/+$/, '');
  chrome.storage.sync.set({ baseUrl: url }, () => {
    status.textContent = 'Saved';
    setTimeout(() => (status.textContent = ''), 1500);
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