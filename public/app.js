const FREE_LIMIT = 5;
const usageKey = 'guestDownloadCount';
const profileKey = 'registeredProfile';

const platformEl = document.getElementById('platform');
const contentTypeEl = document.getElementById('contentType');
const urlInput = document.getElementById('urlInput');
const downloadBtn = document.getElementById('downloadBtn');
const quotaText = document.getElementById('quotaText');
const statusEl = document.getElementById('status');
const registerCard = document.getElementById('registerCard');
const registerForm = document.getElementById('registerForm');

function getGuestUsage() {
  return Number(localStorage.getItem(usageKey) || 0);
}

function setGuestUsage(value) {
  localStorage.setItem(usageKey, String(value));
}

function getProfile() {
  const raw = localStorage.getItem(profileKey);
  return raw ? JSON.parse(raw) : null;
}

function setProfile(profile) {
  localStorage.setItem(profileKey, JSON.stringify(profile));
}

function canDownloadAsGuest() {
  return getGuestUsage() < FREE_LIMIT;
}

function renderQuota() {
  const profile = getProfile();
  const usage = getGuestUsage();

  if (profile) {
    quotaText.textContent = `Registered as ${profile.fullName}. Unlimited downloads unlocked.`;
    registerCard.hidden = true;
    return;
  }

  quotaText.textContent = `Free downloads used: ${usage}/${FREE_LIMIT}`;
  registerCard.hidden = canDownloadAsGuest();
}

function setStatus(message, type = 'default') {
  statusEl.textContent = message;
  statusEl.className = `status ${type === 'error' ? 'error' : type === 'success' ? 'success' : ''}`;
}

function enforceGate() {
  if (!getProfile() && !canDownloadAsGuest()) {
    setStatus('Your 5 free downloads are over. Please register to continue.', 'error');
    registerCard.hidden = false;
    return false;
  }
  return true;
}

async function requestDownload() {
  const url = urlInput.value.trim();
  if (!url) {
    setStatus('Please paste a valid URL.', 'error');
    return;
  }

  if (!enforceGate()) return;

  downloadBtn.disabled = true;
  setStatus('Resolving download link...');

  try {
    const response = await fetch('/api/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        platform: platformEl.value,
        type: contentTypeEl.value,
      }),
    });

    const data = await response.json();
    if (!response.ok || !data.downloadUrl) {
      throw new Error(data.error || 'Unable to fetch a downloadable file.');
    }

    if (!getProfile()) {
      setGuestUsage(getGuestUsage() + 1);
    }

    renderQuota();

    const anchor = document.createElement('a');
    anchor.href = data.downloadUrl;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.textContent = 'Download now';

    statusEl.innerHTML = '';
    setStatus('Link is ready. Opening in a new tab...', 'success');
    statusEl.appendChild(document.createElement('br'));
    statusEl.appendChild(anchor);
    anchor.click();
  } catch (error) {
    setStatus(error.message || 'Unknown error', 'error');
  } finally {
    downloadBtn.disabled = false;
  }
}

downloadBtn.addEventListener('click', requestDownload);

registerForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const fullName = document.getElementById('fullName').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  if (!fullName || !email || password.length < 6) {
    setStatus('Please fill valid registration details.', 'error');
    return;
  }

  setProfile({ fullName, email, createdAt: new Date().toISOString() });
  setStatus('Registration successful. Unlimited access enabled.', 'success');
  renderQuota();
  registerForm.reset();
});

renderQuota();
