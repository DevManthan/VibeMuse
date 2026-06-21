/**
 * VibeMuse — UI Module
 *
 * Handles:
 *  - Virtual piano rendering (2 octaves, absolute-positioned keys)
 *  - Computer keyboard → piano note mapping
 *  - HTML5 Canvas synesthetic particle visualizer
 *  - Chat message appending (with basic markdown rendering)
 *  - Typing indicator
 *  - Quick-action buttons
 *  - Dev panel (left sidebar) toggle
 *  - Guardrail status, student profile, active lesson sandbox updates
 */

import { addLog } from './settings.js';
import { playNote, setVolume } from './audio.js';

// ──────────────────────────────────────────────
// PIANO LAYOUT CONSTANTS
// ──────────────────────────────────────────────
const W  = 34;   // white-key slot width (visual + gap)
const WW = 32;   // white-key visual width
const WH = 88;   // white-key height
const BW = 20;   // black-key width
const BH = 54;   // black-key height

// Pixel offsets of black keys from the left edge of their octave's C
// Derived from standard piano layout ratios
const B_OFF = { 'C#': 12, 'D#': 46, 'F#': 114, 'G#': 148, 'A#': 182 };

const WHITE_NOTES = ['C','D','E','F','G','A','B'];

// Note name → hue value for the synesthetic visualizer
const NOTE_HUE = {
  'C':0, 'C#':22, 'D':44, 'D#':66, 'E':88,
  'F':140, 'F#':165, 'G':190, 'G#':215, 'A':250, 'A#':280, 'B':310,
};

// Computer keyboard → { note, isNextOctave }
const KB_MAP = {
  'a': { note:'C',  next:false }, 's': { note:'D',  next:false },
  'd': { note:'E',  next:false }, 'f': { note:'F',  next:false },
  'g': { note:'G',  next:false }, 'h': { note:'A',  next:false },
  'j': { note:'B',  next:false }, 'k': { note:'C',  next:true  },
  'w': { note:'C#', next:false }, 'e': { note:'D#', next:false },
  't': { note:'F#', next:false }, 'y': { note:'G#', next:false },
  'u': { note:'A#', next:false },
};

// ──────────────────────────────────────────────
// STATE
// ──────────────────────────────────────────────
let currentOctave = 4;
let keyEls = new Map();   // "C4" → HTMLElement

let canvas, ctx;
let canvasW = 240, canvasH = 120;
let particles = [];
const MAX_PARTICLES = 180;

// ──────────────────────────────────────────────
// INIT
// ──────────────────────────────────────────────
export function initUI() {
  // Canvas
  canvas = document.getElementById('visualizer-canvas');
  if (canvas) {
    ctx = canvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
  }

  // Build piano
  buildPiano(currentOctave);

  // Octave selector
  document.getElementById('piano-octave')?.addEventListener('change', e => {
    currentOctave = parseInt(e.target.value);
    buildPiano(currentOctave);
  });

  // Volume slider → audio engine
  document.getElementById('piano-volume')?.addEventListener('input', e => {
    setVolume(parseInt(e.target.value));
  });

  // Chat send button
  document.getElementById('btn-send')?.addEventListener('click', handleSend);

  // Chat textarea — Enter sends, Shift+Enter = newline, auto-resize
  const input = document.getElementById('chat-input');
  input?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  });
  input?.addEventListener('input', e => {
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  });

  // Quick-action prompt buttons
  document.querySelectorAll('.quick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const promptText = btn.dataset.prompt;
      if (input) input.value = promptText;
      handleSend();
    });
  });

  // Dev panel toggle (🔬 button)
  const devToggle = document.getElementById('btn-dev-toggle');
  const sidebarLeft = document.getElementById('sidebar-left');
  const layout = document.querySelector('.app-layout');
  devToggle?.addEventListener('click', () => {
    const hidden = sidebarLeft?.classList.toggle('hidden');
    layout?.classList.toggle('no-left', hidden);
    devToggle.classList.toggle('active', !hidden);
  });

  // Collapsible log panel
  document.getElementById('logs-toggle')?.addEventListener('click', () => {
    document.getElementById('panel-logs')?.classList.toggle('collapsed');
  });

  // Keyboard piano shortcuts
  document.addEventListener('keydown', onKbDown);
  document.addEventListener('keyup',   onKbUp);

  // Listen for audio → highlight piano keys + spawn particles
  document.addEventListener('vibemuse:noteplay', e => {
    const { notes } = e.detail;
    highlightPianoKeys(notes, 'active', 1600);
    spawnParticles(notes);
  });

  // Start canvas animation loop
  requestAnimationFrame(animateCanvas);

  addLog('UI module ready. Piano rendered (C4–B5).', 'info');
}

// ──────────────────────────────────────────────
// CHAT — SEND
// ──────────────────────────────────────────────
function handleSend() {
  const input = document.getElementById('chat-input');
  const text  = input?.value.trim();
  if (!text) return;

  input.value = '';
  input.style.height = 'auto';

  appendMessage('user', text);

  // Dispatch event — agent.js listens in Step 3
  document.dispatchEvent(new CustomEvent('vibemuse:send', { detail: { text } }));
}

// ──────────────────────────────────────────────
// CHAT — APPEND MESSAGE
// ──────────────────────────────────────────────
/**
 * @param {'user'|'agent'} role
 * @param {string}         content   - Plain text or simple markdown
 * @param {{ name: string, args?: object }|null} toolInfo - Optional tool call display
 */
export function appendMessage(role, content, toolInfo = null) {
  const container = document.getElementById('chat-messages');
  if (!container) return null;

  const isAgent = role === 'agent';
  const now     = new Date();
  const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;

  const toolHtml = toolInfo
    ? `<div class="tool-call-bubble">
         <span class="tool-name">⚙ ${escHtml(toolInfo.name)}</span>
         ${toolInfo.args ? `<span style="color:var(--text-muted);font-size:0.7rem"> ${escHtml(JSON.stringify(toolInfo.args)).slice(0, 100)}…</span>` : ''}
       </div>`
    : '';

  const wrap = document.createElement('div');
  wrap.className = `message message-${isAgent ? 'agent' : 'user'}`;
  wrap.innerHTML = `
    ${isAgent ? '<div class="message-avatar">🎵</div>' : ''}
    <div class="message-content">
      <div class="message-bubble">${renderMarkdown(content)}${toolHtml}</div>
      <span class="message-time">${timeStr}</span>
    </div>
  `;

  container.appendChild(wrap);
  container.scrollTop = container.scrollHeight;
  return wrap;
}

// ──────────────────────────────────────────────
// CHAT — SIMPLE MARKDOWN RENDERER
// ──────────────────────────────────────────────
function renderMarkdown(text) {
  // Escape HTML first
  let safe = String(text)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  // Bold, italic, inline code
  safe = safe
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,     '<em>$1</em>')
    .replace(/`(.+?)`/g,       '<code>$1</code>');

  // Headings (##, ###)
  safe = safe.replace(/^#{1,3} (.+)$/gm, '<strong style="font-size:0.95em">$1</strong>');

  // Bullet list items
  safe = safe.replace(/^[-*•] (.+)$/gm,
    '<span style="display:flex;gap:6px;margin:2px 0"><span style="color:var(--brand-cyan)">▸</span><span>$1</span></span>');

  // Numbered list
  safe = safe.replace(/^\d+\. (.+)$/gm,
    '<span style="display:flex;gap:6px;margin:2px 0"><span style="color:var(--brand-purple)">●</span><span>$1</span></span>');

  // Line breaks
  safe = safe.replace(/\n/g, '<br>');

  return safe;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

// ──────────────────────────────────────────────
// TYPING INDICATOR
// ──────────────────────────────────────────────
export function setTyping(visible) {
  const el = document.getElementById('typing-indicator');
  if (el) el.style.display = visible ? 'flex' : 'none';
  if (visible) {
    const container = document.getElementById('chat-messages');
    if (container) container.scrollTop = container.scrollHeight;
  }
}

// ──────────────────────────────────────────────
// PIANO — BUILD
// ──────────────────────────────────────────────
function buildPiano(octave) {
  const wrapper = document.getElementById('piano-wrapper');
  if (!wrapper) return;

  wrapper.innerHTML = '';
  keyEls.clear();

  const octaves   = [octave, octave + 1];
  const totalW    = octaves.length * 7 * W;

  // Inner container — position:relative so keys can be absolute
  const inner = document.createElement('div');
  inner.style.cssText = `position:relative;width:${totalW}px;height:${WH + 4}px;flex-shrink:0;`;

  octaves.forEach((oct, octIdx) => {
    const octOffset = octIdx * 7 * W;

    // White keys first (z-index 1)
    WHITE_NOTES.forEach((note, nIdx) => {
      const el = createKey('white', note, oct, octOffset + nIdx * W);
      inner.appendChild(el);
      keyEls.set(`${note}${oct}`, el);
    });

    // Black keys on top (z-index 2)
    Object.entries(B_OFF).forEach(([note, offset]) => {
      const el = createKey('black', note, oct, octOffset + offset);
      inner.appendChild(el);
      keyEls.set(`${note}${oct}`, el);
    });
  });

  wrapper.appendChild(inner);
}

function createKey(type, note, octave, leftPx) {
  const el = document.createElement('div');
  el.className  = `key-${type}`;
  el.dataset.note = `${note}${octave}`;

  el.style.cssText = `
    position: absolute;
    top: 0;
    left: ${leftPx}px;
    width: ${type === 'white' ? WW : BW}px;
    height: ${type === 'white' ? WH : BH}px;
    ${type === 'black' ? 'z-index:2;' : 'z-index:1;'}
  `;

  // Label on white C keys only
  if (type === 'white' && note === 'C') {
    const label = document.createElement('span');
    label.className   = 'key-label';
    label.textContent = `C${octave}`;
    el.appendChild(label);
  }

  // Mouse events
  el.addEventListener('mousedown', e => { e.preventDefault(); pressKey(el); });
  el.addEventListener('mouseup',   () => releaseKey(el));
  el.addEventListener('mouseleave',() => releaseKey(el));

  // Touch events (mobile)
  el.addEventListener('touchstart', e => { e.preventDefault(); pressKey(el); }, { passive: false });
  el.addEventListener('touchend',   e => { e.preventDefault(); releaseKey(el); }, { passive: false });

  return el;
}

function pressKey(el) {
  el.classList.add('pressed');
  playNote(el.dataset.note);
}

function releaseKey(el) {
  el.classList.remove('pressed');
}

// ──────────────────────────────────────────────
// PIANO — KEYBOARD SHORTCUTS
// ──────────────────────────────────────────────
const heldKbKeys = new Set();

function onKbDown(e) {
  // Don't steal input from the chat textarea
  if (document.activeElement?.id === 'chat-input') return;
  if (e.repeat) return;

  const mapping = KB_MAP[e.key.toLowerCase()];
  if (!mapping) return;

  e.preventDefault();
  heldKbKeys.add(e.key.toLowerCase());

  const oct     = mapping.next ? currentOctave + 1 : currentOctave;
  const noteStr = `${mapping.note}${oct}`;
  const el      = keyEls.get(noteStr);
  if (el) pressKey(el);
}

function onKbUp(e) {
  const mapping = KB_MAP[e.key.toLowerCase()];
  if (!mapping) return;

  heldKbKeys.delete(e.key.toLowerCase());
  const oct     = mapping.next ? currentOctave + 1 : currentOctave;
  const el      = keyEls.get(`${mapping.note}${oct}`);
  if (el) releaseKey(el);
}

// ──────────────────────────────────────────────
// PIANO — HIGHLIGHT KEYS (agent plays chords)
// ──────────────────────────────────────────────
/**
 * @param {string[]} notes     - e.g. ["C4","E4","G4"]
 * @param {'active'|'scale'}  mode
 * @param {number}   durationMs - auto-remove highlight after this many ms (0 = permanent)
 */
export function highlightPianoKeys(notes, mode = 'active', durationMs = 0) {
  if (!notes?.length) return;
  notes.forEach(noteStr => {
    const el = keyEls.get(noteStr);
    if (!el) return;
    el.classList.add(mode);
    if (durationMs > 0) {
      setTimeout(() => el.classList.remove(mode), durationMs);
    }
  });
}

export function clearPianoHighlights(mode = 'active') {
  keyEls.forEach(el => el.classList.remove(mode, 'active', 'scale'));
}

// ──────────────────────────────────────────────
// SANDBOX (Active Lesson panel)
// ──────────────────────────────────────────────
export function updateSandbox(htmlContent) {
  const el = document.getElementById('sandbox-content');
  if (el) el.innerHTML = htmlContent;
}

// ──────────────────────────────────────────────
// STUDENT PROFILE
// ──────────────────────────────────────────────
export function updateProfile({ level, topics } = {}) {
  if (level) {
    const el = document.getElementById('profile-level');
    if (el) el.textContent = level;
  }
  if (topics?.length) {
    const el = document.getElementById('profile-topics');
    if (el) el.innerHTML = topics.map(t => `<span class="tag">${escHtml(t)}</span>`).join('');
  }
}

// ──────────────────────────────────────────────
// GUARDRAIL STATUS
// ──────────────────────────────────────────────
export function updateGuardrail(guardName, passed) {
  document.querySelectorAll('.guardrail-item').forEach(item => {
    const label = item.querySelector('.guardrail-label')?.textContent || '';
    if (!label.toLowerCase().includes(guardName.toLowerCase())) return;

    item.className = `guardrail-item ${passed ? 'pass' : 'fail'}`;
    const icon  = item.querySelector('.guardrail-icon');
    const state = item.querySelector('.guardrail-state');
    if (icon)  icon.textContent  = passed ? '✅' : '❌';
    if (state) state.textContent = passed ? 'PASS' : 'FAIL';
  });
}

// ──────────────────────────────────────────────
// TOKEN USAGE BAR
// ──────────────────────────────────────────────
let totalTokens = 0;
const TOKEN_LIMIT = 1_000_000;

export function updateTokenUsage(newTokens) {
  totalTokens += newTokens;
  const pct = Math.min((totalTokens / TOKEN_LIMIT) * 100, 100);

  const bar   = document.getElementById('token-bar-fill');
  const label = document.getElementById('token-count');
  if (bar)   bar.style.width = `${pct}%`;
  if (label) label.textContent = `${totalTokens.toLocaleString()} / 1,000,000 tokens`;
}

// ──────────────────────────────────────────────
// CANVAS VISUALIZER — PARTICLE SYSTEM
// ──────────────────────────────────────────────
function resizeCanvas() {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  canvasW = rect.width  || 240;
  canvasH = rect.height || 120;
  canvas.width  = canvasW;
  canvas.height = canvasH;
}

function spawnParticles(notes) {
  if (!notes?.length || !canvas) return;

  // Base hue from first note
  const noteName = notes[0].replace(/\d/g, '');
  const baseHue  = NOTE_HUE[noteName] ?? 185;
  const count    = Math.min(14, MAX_PARTICLES - particles.length);

  for (let i = 0; i < count; i++) {
    particles.push({
      x     : (0.1 + Math.random() * 0.8) * canvasW,
      y     : canvasH - 4,
      vx    : (Math.random() - 0.5) * 2.8,
      vy    : -(Math.random() * 3.5 + 1.2),
      size  : Math.random() * 4.5 + 1.5,
      hue   : baseHue + (Math.random() - 0.5) * 50,
      life  : 1.0,
      decay : 0.008 + Math.random() * 0.014,
    });
  }
}

function animateCanvas() {
  if (!ctx) { requestAnimationFrame(animateCanvas); return; }

  // Semi-transparent fill creates a fade-trail effect
  ctx.fillStyle = 'rgba(10, 10, 20, 0.16)';
  ctx.fillRect(0, 0, canvasW, canvasH);

  // Remove dead particles
  particles = particles.filter(p => p.life > 0.01);

  // Update and draw
  particles.forEach(p => {
    p.x  += p.vx;
    p.y  += p.vy;
    p.vy += 0.045;   // gravity
    p.vx *= 0.985;   // air resistance
    p.life -= p.decay;

    const alpha = Math.max(0, p.life);
    const r     = p.size * alpha;

    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(0.5, r), 0, Math.PI * 2);
    ctx.fillStyle   = `hsla(${p.hue},100%,65%,${alpha * 0.85})`;
    ctx.shadowBlur  = 12;
    ctx.shadowColor = `hsl(${p.hue},100%,60%)`;
    ctx.fill();
  });

  ctx.shadowBlur = 0; // reset so other draws aren't affected
  requestAnimationFrame(animateCanvas);
}
