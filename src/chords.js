/**
 * VibeMuse — Chords & Scales Dictionary
 *
 * Provides:
 *   getChordNotes(symbol, octave)  → string[]  e.g. ["C4","E4","G4","B4"]
 *   getScaleNotes(type, root, octave, octaveCount) → string[]
 *   CHORD_QUALITY_LABELS           → human-readable quality descriptions
 */

// ──────────────────────────────────────────────
// 1. CHROMATIC SCALE & ENHARMONIC MAP
// ──────────────────────────────────────────────
const CHROMATIC = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

const ENHARMONIC = {
  'Db':'C#','Eb':'D#','Fb':'E','Gb':'F#','Ab':'G#','Bb':'A#','Cb':'B',
};

// ──────────────────────────────────────────────
// 2. CHORD INTERVAL DEFINITIONS (semitones from root)
// ──────────────────────────────────────────────
const INTERVALS = {
  // Triads
  'maj'    : [0, 4, 7],
  ''       : [0, 4, 7],          // default: major
  'min'    : [0, 3, 7],
  'm'      : [0, 3, 7],
  'dim'    : [0, 3, 6],
  'aug'    : [0, 4, 8],
  'sus2'   : [0, 2, 7],
  'sus4'   : [0, 5, 7],
  '5'      : [0, 7],             // power chord

  // Dominant sevenths
  '7'      : [0, 4, 7, 10],
  'dom7'   : [0, 4, 7, 10],

  // Major sevenths
  'maj7'   : [0, 4, 7, 11],
  'M7'     : [0, 4, 7, 11],

  // Minor sevenths
  'min7'   : [0, 3, 7, 10],
  'm7'     : [0, 3, 7, 10],

  // Other sevenths
  'dim7'       : [0, 3, 6, 9],
  'half-dim7'  : [0, 3, 6, 10],
  'm7b5'       : [0, 3, 6, 10],
  'minmaj7'    : [0, 3, 7, 11],
  'mM7'        : [0, 3, 7, 11],
  'aug7'       : [0, 4, 8, 10],
  'augmaj7'    : [0, 4, 8, 11],

  // Extended chords
  '9'      : [0, 4, 7, 10, 14],
  'maj9'   : [0, 4, 7, 11, 14],
  'min9'   : [0, 3, 7, 10, 14],
  'm9'     : [0, 3, 7, 10, 14],
  '11'     : [0, 4, 7, 10, 14, 17],
  'maj11'  : [0, 4, 7, 11, 14, 17],
  '13'     : [0, 4, 7, 10, 14, 17, 21],

  // Add chords
  'add9'   : [0, 4, 7, 14],
  'madd9'  : [0, 3, 7, 14],
  'add11'  : [0, 4, 7, 17],
  '6'      : [0, 4, 7, 9],
  'm6'     : [0, 3, 7, 9],
  '69'     : [0, 4, 7, 9, 14],
};

// ──────────────────────────────────────────────
// 3. HUMAN-READABLE QUALITY LABELS
// ──────────────────────────────────────────────
export const CHORD_QUALITY_LABELS = {
  'maj'    : 'Major — bright, happy, stable',
  'min'    : 'Minor — dark, melancholic, introspective',
  'dim'    : 'Diminished — tense, unstable, dissonant',
  'aug'    : 'Augmented — dreamy, ambiguous, floating',
  'sus2'   : 'Suspended 2nd — open, spacious, unresolved',
  'sus4'   : 'Suspended 4th — anticipatory, unresolved',
  '7'      : 'Dominant 7th — bluesy, tense, wants to resolve',
  'maj7'   : 'Major 7th — jazzy, sophisticated, warm',
  'min7'   : 'Minor 7th — smooth, cool, R&B/jazz feel',
  'dim7'   : 'Diminished 7th — mysterious, dramatic, horror-ish',
  'm7b5'   : 'Half-Diminished — tense but softer than dim7',
  '9'      : 'Dominant 9th — funky, soulful, full-bodied',
  'maj9'   : 'Major 9th — lush, cinematic, sophisticated',
  'min9'   : 'Minor 9th — melancholic beauty, neo-soul',
  'add9'   : 'Add 9th — bright open major with extra colour',
};

// ──────────────────────────────────────────────
// 4. PARSE CHORD SYMBOL
// e.g. "Cmaj7" → { root: "C", quality: "maj7" }
//      "F#m7"  → { root: "F#", quality: "m7" }
//      "Bb9"   → { root: "A#", quality: "9" }
// ──────────────────────────────────────────────
export function parseChordSymbol(symbol) {
  if (!symbol || typeof symbol !== 'string') return null;

  symbol = symbol.trim();
  if (!symbol) return null;

  // Extract root (1 or 2 chars)
  let root = symbol[0].toUpperCase();
  let rest = symbol.slice(1);

  if (rest[0] === '#') {
    root += '#';
    rest = rest.slice(1);
  } else if (rest[0] === 'b' && rest.length > 1) {
    // e.g. "Bb7" — the 'b' is a flat, not the note name
    root += 'b';
    rest = rest.slice(1);
  }

  // Normalise flats → sharps
  if (ENHARMONIC[root]) root = ENHARMONIC[root];

  // Normalise quality aliases
  let quality = rest;
  if (quality === 'M')          quality = 'maj';
  if (quality === 'major')      quality = 'maj';
  if (quality === 'minor')      quality = 'min';
  if (quality === 'Major7')     quality = 'maj7';
  if (quality === 'Minor7')     quality = 'min7';

  return { root, quality: quality || 'maj' };
}

// ──────────────────────────────────────────────
// 5. GET CHORD NOTES
// Returns an array of Tone.js note strings for a chord symbol.
// ──────────────────────────────────────────────
export function getChordNotes(symbol, octave = 4) {
  const parsed = parseChordSymbol(symbol);
  if (!parsed) return [];

  const { root, quality } = parsed;
  const intervals = INTERVALS[quality] ?? INTERVALS['maj'];

  const rootIdx = CHROMATIC.indexOf(root);
  if (rootIdx === -1) {
    console.warn(`[Chords] Unknown root note: "${root}"`);
    return [];
  }

  return intervals.map(semitones => {
    const noteIdx  = (rootIdx + semitones) % 12;
    const noteOct  = octave + Math.floor((rootIdx + semitones) / 12);
    return `${CHROMATIC[noteIdx]}${noteOct}`;
  });
}

// ──────────────────────────────────────────────
// 6. SCALE DEFINITIONS
// ──────────────────────────────────────────────
export const SCALES = {
  // Diatonic
  'major'            : { intervals: [0,2,4,5,7,9,11],    label: 'Major Scale',             mood: 'Happy, bright, uplifting' },
  'naturalMinor'     : { intervals: [0,2,3,5,7,8,10],    label: 'Natural Minor Scale',      mood: 'Dark, melancholic, emotional' },
  'harmonicMinor'    : { intervals: [0,2,3,5,7,8,11],    label: 'Harmonic Minor Scale',     mood: 'Exotic, tense, dramatic' },
  'melodicMinor'     : { intervals: [0,2,3,5,7,9,11],    label: 'Melodic Minor Scale',      mood: 'Smooth minor with a hopeful lift' },

  // Pentatonic
  'majorPentatonic'  : { intervals: [0,2,4,7,9],         label: 'Major Pentatonic',         mood: 'Simple, folk, country' },
  'minorPentatonic'  : { intervals: [0,3,5,7,10],        label: 'Minor Pentatonic',         mood: 'Bluesy, rock, soulful' },

  // Blues
  'blues'            : { intervals: [0,3,5,6,7,10],      label: 'Blues Scale',              mood: 'Soulful, gritty, expressive' },

  // Modes
  'dorian'           : { intervals: [0,2,3,5,7,9,10],    label: 'Dorian Mode',              mood: 'Jazz, rock, funky (slightly less dark)' },
  'phrygian'         : { intervals: [0,1,3,5,7,8,10],    label: 'Phrygian Mode',            mood: 'Spanish, flamenco, dark and exotic' },
  'lydian'           : { intervals: [0,2,4,6,7,9,11],    label: 'Lydian Mode',              mood: 'Dream-like, ethereal, John Williams' },
  'mixolydian'       : { intervals: [0,2,4,5,7,9,10],    label: 'Mixolydian Mode',          mood: 'Rock, blues, triumphant' },
  'locrian'          : { intervals: [0,1,3,5,6,8,10],    label: 'Locrian Mode',             mood: 'Very dark, unstable, dissonant' },

  // Symmetric
  'wholeTone'        : { intervals: [0,2,4,6,8,10],      label: 'Whole Tone Scale',         mood: 'Impressionist, floating, Debussy' },
  'diminished'       : { intervals: [0,2,3,5,6,8,9,11],  label: 'Diminished Scale',         mood: 'Tense, jazzy, complex' },
  'chromatic'        : { intervals: [0,1,2,3,4,5,6,7,8,9,10,11], label: 'Chromatic Scale', mood: 'All 12 notes' },
};

// ──────────────────────────────────────────────
// 7. GET SCALE NOTES
// Returns note strings across 1 or more octaves.
// ──────────────────────────────────────────────
export function getScaleNotes(scaleType, root, startOctave = 4, octaveCount = 2) {
  const scale = SCALES[scaleType];
  if (!scale) {
    console.warn(`[Chords] Unknown scale: "${scaleType}"`);
    return [];
  }

  // Normalise root
  let normRoot = root;
  if (normRoot?.length > 1 && !normRoot.includes('#')) {
    normRoot = ENHARMONIC[normRoot] || normRoot;
  }

  const rootIdx = CHROMATIC.indexOf(normRoot);
  if (rootIdx === -1) {
    console.warn(`[Chords] Unknown root note: "${root}"`);
    return [];
  }

  const notes = [];
  for (let o = 0; o < octaveCount; o++) {
    scale.intervals.forEach(semitones => {
      const absIdx  = rootIdx + semitones;
      const noteIdx = absIdx % 12;
      const noteOct = startOctave + o + Math.floor(absIdx / 12);
      notes.push(`${CHROMATIC[noteIdx]}${noteOct}`);
    });
  }

  // Add root at top for closure
  notes.push(`${normRoot}${startOctave + octaveCount}`);

  return notes;
}

// ──────────────────────────────────────────────
// 8. FAMOUS SONG CHORD PROGRESSIONS (built-in DB)
// The agent can reference these for song-based learning.
// ──────────────────────────────────────────────
export const SONG_PROGRESSIONS = {
  'let it be'             : { chords: ['C','G','Am','F'],         artist: 'The Beatles',  key: 'C major' },
  'imagine'               : { chords: ['C','Cmaj7','F','Am','Dm','G','E7'], artist: 'John Lennon', key: 'C major' },
  'someone like you'      : { chords: ['A','E','F#m','D'],        artist: 'Adele',        key: 'A major' },
  'stay with me'          : { chords: ['Am','F','C','G'],         artist: 'Sam Smith',    key: 'C major' },
  'purple rain'           : { chords: ['Bb','F','Gm','Eb'],       artist: 'Prince',       key: 'Bb major' },
  'creep'                 : { chords: ['G','B','C','Cm'],         artist: 'Radiohead',    key: 'G major' },
  'hallelujah'            : { chords: ['C','Am','C','Am','F','G','C','G'], artist: 'Leonard Cohen', key: 'C major' },
  'wonderful tonight'     : { chords: ['G','D','C','D'],          artist: 'Eric Clapton', key: 'G major' },
  'bad guy'               : { chords: ['Am','Dm','F','E'],        artist: 'Billie Eilish', key: 'A minor' },
  'all of me'             : { chords: ['Fmaj7','Ab','Eb','Bb'],   artist: 'John Legend',  key: 'F major' },
  'still dre'             : { chords: ['Dm','C','Bb','A'],        artist: 'Dr. Dre',      key: 'D minor' },
  'rolling in the deep'   : { chords: ['Am','G','F'],             artist: 'Adele',        key: 'A minor' },
  'wake me up'            : { chords: ['Am','C','G','F'],         artist: 'Avicii',       key: 'A minor' },
  'blinding lights'       : { chords: ['Am','F','C','G'],         artist: 'The Weeknd',   key: 'A minor' },
  'love story'            : { chords: ['G','D','Em','C'],         artist: 'Taylor Swift', key: 'G major' },
};

/**
 * Look up a song by name (fuzzy match).
 * @param {string} query
 * @returns {{ chords, artist, key } | null}
 */
export function lookupSong(query) {
  if (!query) return null;
  const q = query.toLowerCase().trim();
  for (const [name, data] of Object.entries(SONG_PROGRESSIONS)) {
    if (name.includes(q) || q.includes(name)) return { name, ...data };
  }
  return null;
}
