/**
 * VibeMuse — Main Entry Point
 *
 * Boot order:
 *  1. initSettings  → Load saved API key, preferences
 *  2. initUI        → Render piano, canvas, wire chat events
 *  3. initAudio     → Start Tone.js synth (async — awaited)
 *  4. initAgent     → Start Gemini AI agent (Step 3)
 *
 * ES modules are automatically deferred by the browser —
 * the DOM is always fully parsed by the time this code runs.
 *
 * ─────────────────────────────────────────────
 * GEMINI API KEY:
 *   Enter your key in the ⚙️ Settings modal in the app.
 *   It is saved to localStorage under 'vibemuse_api_key'.
 *   To hardcode a key for development, open src/settings.js
 *   and set the HARDCODED_KEY constant at the top of the file.
 * ─────────────────────────────────────────────
 */

import { initSettings } from './settings.js';
import { initUI }       from './ui.js';
import { initAudio }    from './audio.js';
import { initAgent }    from './agent.js';

console.log('[VibeMuse] Booting...');

initSettings();  // Sync — load prefs & wire settings modal
initUI();        // Sync — render piano, canvas, attach event listeners

await initAudio(); // Async — Tone.js synth setup (must complete before agent plays audio)

initAgent();     // Sync — wire Gemini agent (Step 3)

console.log('[VibeMuse] All systems go. 🎵');
