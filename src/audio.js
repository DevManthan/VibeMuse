/**
 * VibeMuse — Audio Module
 * Tone.js polyphonic synthesizer engine.
 *
 * Provides: initAudio, playNote, playChord, playChordProgression, stopAll, setVolume
 * Dispatches: 'vibemuse:noteplay' event with { notes, index, total } for UI sync.
 *
 * NOTE ON GEMINI API KEY:
 *   The API key is stored in localStorage via the Settings modal.
 *   To hardcode a key for development, set it here:
 *   const HARDCODED_API_KEY = 'YOUR_KEY_HERE';
 *   Then in settings.js getApiKey(), add: return HARDCODED_API_KEY || localStorage...
 */

import { addLog } from './settings.js';

let synth     = null;   // Tone.PolySynth instance
let masterVol = null;   // Tone.Volume master node
let isReady   = false;

// ──────────────────────────────────────────────
// INIT
// ──────────────────────────────────────────────
export async function initAudio() {
  if (typeof Tone === 'undefined') {
    addLog('⚠️ Tone.js not loaded — audio disabled.', 'warn');
    return;
  }

  try {
    // Master volume node
    masterVol = new Tone.Volume(-4).toDestination();

    // Reverb for depth (non-blocking generate)
    const reverb = new Tone.Reverb({ decay: 1.8, preDelay: 0.02, wet: 0.22 });
    reverb.connect(masterVol);
    reverb.generate(); // resolves async — audio still works immediately

    // Warm polyphonic synth (triangle oscillator = rounded, mellow tone)
    synth = new Tone.PolySynth(Tone.Synth, {
      oscillator : { type: 'triangle8' },
      envelope   : { attack: 0.02, decay: 0.35, sustain: 0.3, release: 1.3 },
      volume     : -6,
    });
    synth.connect(reverb);
    synth.maxPolyphony = 12;

    isReady = true;
    addLog('🎵 Audio engine ready — PolySynth + Reverb loaded.', 'success');
  } catch (err) {
    addLog(`Audio init failed: ${err.message}`, 'error');
    console.error('[Audio]', err);
  }
}

// ──────────────────────────────────────────────
// INTERNAL — Ensure AudioContext is running
// (browsers require a user gesture before allowing audio)
// ──────────────────────────────────────────────
async function ensureCtx() {
  if (!isReady || !synth) {
    addLog('⚠️ Audio not ready. Tap the screen first.', 'warn');
    return false;
  }
  if (Tone.context.state !== 'running') {
    try { await Tone.start(); } catch (_) {}
  }
  return true;
}

// ──────────────────────────────────────────────
// PUBLIC API
// ──────────────────────────────────────────────

/**
 * Play a single note.
 * @param {string} note  - e.g. "C4", "F#5"
 * @param {string} dur   - Tone.js duration notation, default "8n" (eighth note)
 */
export async function playNote(note, dur = '8n') {
  if (!await ensureCtx()) return;
  synth.triggerAttackRelease(note, dur);
  _dispatch([note]);
}

/**
 * Play multiple notes simultaneously (a chord).
 * @param {string[]} notes - e.g. ["C4","E4","G4"]
 * @param {string}   dur   - default "2n" (half note)
 */
export async function playChord(notes, dur = '2n') {
  if (!await ensureCtx()) return;
  synth.triggerAttackRelease(notes, dur);
  _dispatch(notes);
}

/**
 * Play a sequence of chords with timing via Tone.Transport.
 * @param {string[][]} chords  - array of note arrays
 * @param {number}     bpm     - beats per minute (default 82)
 * @param {number}     beatsPerChord - how many beats each chord lasts (default 2)
 */
export async function playChordProgression(chords, bpm = 82, beatsPerChord = 2) {
  if (!await ensureCtx()) return;
  if (!chords?.length) return;

  stopAll();
  Tone.Transport.bpm.value = bpm;
  Tone.Transport.cancel();

  const secPerChord = (60 / bpm) * beatsPerChord;

  chords.forEach((notes, i) => {
    Tone.Transport.schedule(time => {
      synth.triggerAttackRelease(notes, `${beatsPerChord}n`, time);
      // Dispatch to UI for piano key highlighting
      _dispatch(notes, i, chords.length);
    }, `+${i * secPerChord + 0.05}`);
  });

  // Schedule stop after last chord
  Tone.Transport.schedule(() => {
    Tone.Transport.stop();
  }, `+${chords.length * secPerChord + 0.1}`);

  Tone.Transport.start();
  addLog(`▶ Playing ${chords.length} chords @ ${bpm} BPM`, 'tool');
}

/**
 * Stop all active notes and the Transport.
 */
export function stopAll() {
  try {
    synth?.releaseAll();
    if (Tone.Transport.state !== 'stopped') {
      Tone.Transport.stop();
    }
    Tone.Transport.cancel();
  } catch (_) {}
}

/**
 * Set master volume.
 * @param {number} val - 0 (silent) to 100 (full)
 */
export function setVolume(val) {
  if (!masterVol) return;
  // Map 0–100 → -40dB to 0dB (log scale)
  masterVol.volume.value = val <= 0 ? -Infinity : -40 + (val / 100) * 40;
}

// ──────────────────────────────────────────────
// INTERNAL — Dispatch note event to UI
// ──────────────────────────────────────────────
function _dispatch(notes, index = 0, total = 1) {
  document.dispatchEvent(new CustomEvent('vibemuse:noteplay', {
    detail: { notes, index, total }
  }));
}
