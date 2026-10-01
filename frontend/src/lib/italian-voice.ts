import { useEffect, useState, useSyncExternalStore } from 'react';

// Synthèse vocale italienne (Web Speech API, voix installées dans le navigateur / le système) :
// aucun appel serveur ni clé, fonctionne hors ligne avec une voix locale.

export const ITALIAN = 'it-IT';
export const SLOW_RATE = 0.7;
const PREFS_KEY = 'salve.voice.it';

export const synthesisSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

export function italianVoices(): SpeechSynthesisVoice[] {
  if (!synthesisSupported()) return [];
  return window.speechSynthesis.getVoices().filter((voice) => voice.lang.toLowerCase().replace('_', '-').startsWith('it'));
}

// Voix « naturelles » (Edge/Windows) et Google d'abord : nettement plus intelligibles.
function rankVoice(voice: SpeechSynthesisVoice): number {
  const name = voice.name.toLowerCase();
  if (name.includes('natural') || name.includes('online')) return 0;
  if (name.includes('google')) return 1;
  if (voice.lang === ITALIAN) return 2;
  return 3;
}

export function useItalianVoices(): SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => italianVoices());
  useEffect(() => {
    if (!synthesisSupported()) return;
    // Chrome charge la liste des voix de façon asynchrone.
    const update = () => setVoices([...italianVoices()].sort((a, b) => rankVoice(a) - rankVoice(b)));
    update();
    window.speechSynthesis.addEventListener('voiceschanged', update);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', update);
  }, []);
  return voices;
}

interface VoicePrefs {
  voiceName?: string;
  rate?: number;
}

export function loadVoicePrefs(): VoicePrefs {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as VoicePrefs;
  } catch {
    return {};
  }
}

export function saveVoicePrefs(prefs: VoicePrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...loadVoicePrefs(), ...prefs }));
  } catch {
    // Stockage indisponible (navigation privée) : réglage non mémorisé.
  }
}

// Nettoie un extrait de cours avant lecture : Markdown, flèches, numéros, trous.
export function cleanForSpeech(text: string): string {
  return text
    .replace(/\*\*|__|[*`]/g, '')
    .replace(/_{2,}/g, ' … ')
    .replace(/[→↔⇒]/g, ', ')
    .replace(/\s*[«»]\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Découpage en phrases : certaines voix s'interrompent sur les textes longs (Chrome, ~15 s).
function chunks(text: string): string[] {
  const sentences = text.match(/[^.!?;]+[.!?;]*/g) ?? [text];
  const result: string[] = [];
  for (const sentence of sentences.map((value) => value.trim()).filter(Boolean)) {
    const last = result.at(-1);
    if (last && last.length + sentence.length < 180) result[result.length - 1] = `${last} ${sentence}`;
    else result.push(sentence);
  }
  return result;
}

// ── Lecture en cours (un seul extrait à la fois, partagé par tous les boutons) ──

let playing: string | null = null;
const listeners = new Set<() => void>();
const setPlaying = (id: string | null) => {
  playing = id;
  listeners.forEach((listener) => listener());
};

export function usePlayingId(): string | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => playing,
    () => null,
  );
}

export interface SpeakOptions {
  id?: string;
  rate?: number;
  voiceName?: string;
  onEnd?: () => void;
}

// Lit une suite d'extraits (ex. les répliques d'un dialogue) avec une courte pause entre chacun.
export function speakItalian(texts: string | string[], options: SpeakOptions = {}): boolean {
  if (!synthesisSupported()) return false;
  const synth = window.speechSynthesis;
  synth.cancel();
  const prefs = loadVoicePrefs();
  const voices = italianVoices().sort((a, b) => rankVoice(a) - rankVoice(b));
  const wanted = options.voiceName ?? prefs.voiceName;
  const voice = voices.find((candidate) => candidate.name === wanted) ?? voices[0];
  const rate = options.rate ?? prefs.rate ?? 1;
  const parts = (Array.isArray(texts) ? texts : [texts]).map(cleanForSpeech).filter(Boolean).flatMap(chunks);
  if (parts.length === 0) return false;

  const id = options.id ?? parts.join(' ');
  setPlaying(id);
  parts.forEach((part, index) => {
    const utterance = new SpeechSynthesisUtterance(part);
    utterance.lang = ITALIAN;
    if (voice) utterance.voice = voice;
    utterance.rate = rate;
    if (index === parts.length - 1) {
      utterance.onend = () => {
        if (playing === id) setPlaying(null);
        options.onEnd?.();
      };
      utterance.onerror = () => {
        if (playing === id) setPlaying(null);
      };
    }
    synth.speak(utterance);
  });
  return true;
}

export function stopItalian() {
  if (synthesisSupported()) window.speechSynthesis.cancel();
  setPlaying(null);
}

// Comparaison « répétez après moi » : part des mots attendus retrouvés dans la transcription.
export function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

export function pronunciationScore(expected: string, heard: string): { score: number; missing: string[] } {
  const target = normalizeWords(expected);
  const said = normalizeWords(heard);
  if (target.length === 0) return { score: 0, missing: [] };
  const pool = [...said];
  const missing: string[] = [];
  for (const word of target) {
    const index = pool.indexOf(word);
    if (index >= 0) pool.splice(index, 1);
    else missing.push(word);
  }
  return { score: Math.round(((target.length - missing.length) / target.length) * 100), missing };
}
