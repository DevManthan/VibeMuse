/**
 * VibeMuse — Settings Module
 * Loads/saves Gemini API key, model choice, skill mode from localStorage.
 * Also wires up the Settings modal UI (open/close, save, clear memory).
 */

const STORAGE_KEY_API   = 'vibemuse_api_key';
const STORAGE_KEY_MODEL = 'vibemuse_model';
const STORAGE_KEY_SKILL = 'vibemuse_skill';

export function initSettings() {
  const $modal       = document.getElementById('modal-settings');
  const $btnOpen     = document.getElementById('btn-settings');
  const $btnClose    = document.getElementById('btn-close-settings');
  const $btnSave     = document.getElementById('btn-save-settings');
  const $btnClear    = document.getElementById('btn-clear-memory');
  const $btnToggle   = document.getElementById('btn-toggle-key');
  const $apiInput    = document.getElementById('api-key-input');
  const $modelSelect = document.getElementById('model-select');
  const $skillSelect = document.getElementById('skill-select');

  // Load saved values
  $apiInput.value    = getApiKey()  || '';
  $modelSelect.value = getModel()   || 'gemini-2.0-flash';
  $skillSelect.value = getSkill()   || 'tutor';

  // Open settings
  $btnOpen.addEventListener('click', () => {
    $modal.style.display = 'flex';
  });

  // Close settings
  $btnClose.addEventListener('click', closeModal);
  $modal.addEventListener('click', (e) => {
    if (e.target === $modal) closeModal();
  });

  function closeModal() {
    $modal.style.display = 'none';
  }

  // Toggle API key visibility
  $btnToggle.addEventListener('click', () => {
    const isHidden = $apiInput.type === 'password';
    $apiInput.type = isHidden ? 'text' : 'password';
    $btnToggle.textContent = isHidden ? '🔒' : '👁️';
  });

  // Save settings
  $btnSave.addEventListener('click', () => {
    const key   = $apiInput.value.trim();
    const model = $modelSelect.value;
    const skill = $skillSelect.value;

    if (key) {
      localStorage.setItem(STORAGE_KEY_API,   key);
      localStorage.setItem(STORAGE_KEY_MODEL, model);
      localStorage.setItem(STORAGE_KEY_SKILL, skill);
      addLog('Settings saved. API key stored locally.', 'success');
      closeModal(); // Only close on successful save
    } else {
      addLog('⚠️ API key is empty — please enter a key to save.', 'warn');
      $apiInput.focus();
      // Do NOT close modal so user can correct the input
    }
  });

  // Clear memory
  $btnClear.addEventListener('click', () => {
    localStorage.removeItem('vibemuse_history');
    localStorage.removeItem('vibemuse_profile');
    addLog('Conversation memory cleared.', 'warn');
    closeModal();
  });

  addLog('Settings module initialized.', 'info');
}

export function getApiKey()  { return localStorage.getItem(STORAGE_KEY_API) || ''; }
export function getModel()   { return localStorage.getItem(STORAGE_KEY_MODEL) || 'gemini-2.0-flash'; }
export function getSkill()   { return localStorage.getItem(STORAGE_KEY_SKILL) || 'tutor'; }

// -----------------------------------------------
// Shared Logging Helper (writes to sidebar logs)
// -----------------------------------------------
export function addLog(message, type = 'info') {
  const container = document.getElementById('logs-container');
  if (!container) return;

  const now     = new Date();
  const timeStr = `${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;

  const entry = document.createElement('div');
  entry.className = `log-entry log-${type}`;
  entry.innerHTML = `<span class="log-time">${timeStr}</span><span class="log-msg">${escapeHtml(message)}</span>`;
  container.appendChild(entry);
  container.scrollTop = container.scrollHeight;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[m]));
}
