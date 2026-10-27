/**
 * Punctuation & capitalization restoration for Vosk's raw, lowercase output.
 *
 * Vosk returns "hello world i am fine" without punctuation. This module uses the
 * word timings and per-word prosody (pitch F0 + energy) to:
 *  - split into sentences on pauses (and pitch resets),
 *  - end each sentence with `.`, `?` (rising pitch) or `!` (loud),
 *  - capitalize sentence starts and the Russian "я".
 *
 * Pure functions, no dependencies.
 */

export interface TranscribedWord {
  word: string;
  start: number; // seconds
  end: number; // seconds
}

export interface WordProsody {
  /** Pitch estimate in Hz (0 = unvoiced / not measured). */
  f0: number;
  /** RMS energy, roughly normalized to 0..1. */
  energy: number;
}

const SILENCE_GAP_S = 0.6; // pause (seconds) that ends a sentence
const RISING_F0_RATIO = 1.15; // last-word F0 vs sentence mean => question
const LOUD_ENERGY_RATIO = 1.8; // last-word energy vs sentence mean => exclamation

function capitalize(word: string): string {
  if (!word) return word;
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function hasEndPunct(s: string): boolean {
  return /[.!?…]$/.test(s);
}

/**
 * Finalizes a sentence: picks the ending mark and capitalizes. `prosody` is the
 * aligned per-word prosody (may be shorter than `words`).
 */
function finalizeSentence(
  sentenceWords: string[],
  lastIndex: number,
  prosody: WordProsody[] | undefined,
): string {
  if (sentenceWords.length === 0) return '';

  // Mean F0 and energy over the sentence (voiced words only for F0).
  let f0Sum = 0;
  let f0Count = 0;
  let energySum = 0;
  let energyCount = 0;

  const start = lastIndex - sentenceWords.length + 1;
  for (let i = start; i <= lastIndex; i++) {
    const p = prosody?.[i];
    if (!p) continue;
    if (p.f0 > 0) {
      f0Sum += p.f0;
      f0Count++;
    }
    energySum += p.energy;
    energyCount++;
  }

  const meanF0 = f0Count > 0 ? f0Sum / f0Count : 0;
  const meanEnergy = energyCount > 0 ? energySum / energyCount : 0;

  const last = prosody?.[lastIndex];

  let mark = '.';
  if (last && meanF0 > 0 && last.f0 > meanF0 * RISING_F0_RATIO) {
    mark = '?';
  } else if (last && meanEnergy > 0 && last.energy > meanEnergy * LOUD_ENERGY_RATIO) {
    mark = '!';
  }

  // Capitalize the first word and "я".
  const text = sentenceWords
    .map((w, i) => {
      if (i === 0 || w === 'я') return capitalize(w);
      return w;
    })
    .join(' ');

  return hasEndPunct(text) ? text : `${text}${mark}`;
}

/**
 * Restores punctuation and capitalization from raw text + word timings + prosody.
 */
export function punctuate(
  text: string,
  words?: TranscribedWord[],
  prosody?: WordProsody[],
): string {
  // No timing info — fall back to a single capitalized sentence.
  if (!words || words.length === 0) {
    const trimmed = text.trim();
    if (!trimmed) return trimmed;
    const capped = capitalize(trimmed);
    return hasEndPunct(capped) ? capped : `${capped}.`;
  }

  const sentences: string[] = [];
  let current: string[] = [];

  for (let i = 0; i < words.length; i++) {
    const gap = i > 0 ? words[i].start - words[i - 1].end : 0;

    if (i > 0 && gap > SILENCE_GAP_S && current.length > 0) {
      sentences.push(finalizeSentence(current, i - 1, prosody));
      current = [];
    }
    current.push(words[i].word);
  }
  if (current.length > 0) {
    sentences.push(finalizeSentence(current, words.length - 1, prosody));
  }

  return sentences.join(' ').trim();
}
