import './course.css';
import { useEffect, useRef, useState } from 'react';
import { RECOGNITION_ERROR_MESSAGES, speechSupport, useSpeechRecognition } from '../../hooks/useSpeech';
import {
  ITALIAN,
  loadVoicePrefs,
  pronunciationScore,
  saveVoicePrefs,
  speakItalian,
  stopItalian,
  synthesisSupported,
  SLOW_RATE,
  usePlayingId,
  useItalianVoices,
} from '../../lib/italian-voice';

const PLAYING_ID = 'assistant';
const STARTERS = ['Buongiorno, mi chiamo Grâce.', 'Piacere!', 'Grazie mille.', 'Scusi, non ho capito.', 'Vorrei studiare in Italia.', 'Gli gnocchi', 'La chiave'];

interface Attempt {
  heard: string;
  score: number;
  missing: string[];
}

// Assistant de prononciation : écouter un mot ou une phrase en italien (normal ou lent),
// puis le répéter au micro pour obtenir un retour (reconnaissance vocale du navigateur).
export function PronunciationAssistant({ words = [] }: { words?: string[] }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [rate, setRate] = useState(() => loadVoicePrefs().rate ?? 1);
  const [voiceName, setVoiceName] = useState(() => loadVoicePrefs().voiceName ?? '');
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const voices = useItalianVoices();
  const playingId = usePlayingId();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const target = text.trim();

  const recognition = useSpeechRecognition((heard) => {
    recognition.stop();
    setAttempt({ heard, ...pronunciationScore(target, heard) });
  }, ITALIAN);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const play = (value: string, playbackRate = rate) => {
    if (!value.trim()) return;
    speakItalian(value, { id: PLAYING_ID, rate: playbackRate, ...(voiceName && { voiceName }) });
  };

  const choose = (value: string) => {
    setText(value);
    setAttempt(null);
    play(value);
  };

  const supported = synthesisSupported();
  const canListen = speechSupport.recognition();
  const playing = playingId === PLAYING_ID;
  const recognitionError = recognition.error
    ? recognition.error === 'unsupported'
      ? 'La reconnaissance vocale n’est pas disponible dans ce navigateur (essayez Chrome ou Edge).'
      : (RECOGNITION_ERROR_MESSAGES[recognition.error] ?? 'La reconnaissance vocale a échoué. Réessayez.')
    : null;

  return (
    <>
      <button
        type="button"
        className="pron-fab"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="pronunciation-assistant"
      >
        <span aria-hidden="true">🗣️</span>
        <span className="hidden sm:inline">Prononciation</span>
      </button>

      {open && (
        <section id="pronunciation-assistant" className="pron-panel" aria-label="Assistant de prononciation">
          <header className="pron-head">
            <div>
              <p className="pron-title">Assistant de prononciation</p>
              <p className="pron-sub">Écoutez l’italien, puis répétez.</p>
            </div>
            <button type="button" className="pron-close" onClick={() => setOpen(false)} aria-label="Fermer l’assistant">
              ✕
            </button>
          </header>

          {!supported ? (
            <p className="pron-note">La synthèse vocale n’est pas disponible dans ce navigateur. Essayez Chrome, Edge ou Safari à jour.</p>
          ) : (
            <>
              <label className="sr-only" htmlFor="pron-text">Texte en italien</label>
              <textarea
                id="pron-text"
                ref={inputRef}
                rows={2}
                maxLength={400}
                className="pron-input"
                placeholder="Écrivez un mot ou une phrase en italien…"
                value={text}
                onChange={(event) => {
                  setText(event.target.value);
                  setAttempt(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    play(text);
                  }
                }}
              />
              <div className="pron-actions">
                <button type="button" className="pron-primary" disabled={!target} onClick={() => (playing ? stopItalian() : play(text))}>
                  {playing ? '■ Arrêter' : '🔊 Écouter'}
                </button>
                <button type="button" className="pron-secondary" disabled={!target} onClick={() => play(text, SLOW_RATE)}>
                  🐢 Lentement
                </button>
                {canListen && (
                  <button
                    type="button"
                    className={`pron-secondary ${recognition.listening ? 'is-live' : ''}`}
                    disabled={!target}
                    onClick={() => {
                      if (recognition.listening) recognition.stop();
                      else {
                        stopItalian();
                        setAttempt(null);
                        recognition.start();
                      }
                    }}
                  >
                    {recognition.listening ? '⏹ J’ai fini' : '🎙️ À moi'}
                  </button>
                )}
              </div>

              {recognition.listening && <p className="pron-note">Parlez maintenant… {recognition.interim && <em>« {recognition.interim} »</em>}</p>}
              {recognitionError && <p className="pron-error">{recognitionError}</p>}
              {attempt && (
                <div className={`pron-result ${attempt.score >= 80 ? 'is-good' : attempt.score >= 50 ? 'is-mid' : 'is-low'}`} role="status">
                  <p className="pron-score">
                    {attempt.score >= 80 ? 'Bravo !' : attempt.score >= 50 ? 'Presque !' : 'Encore un effort'} · {attempt.score} %
                  </p>
                  <p>
                    Entendu : <em>« {attempt.heard} »</em>
                  </p>
                  {attempt.missing.length > 0 && <p>À retravailler : {attempt.missing.join(', ')}</p>}
                </div>
              )}

              <details className="pron-settings">
                <summary>Réglages de la voix</summary>
                <label className="pron-field">
                  <span>Voix</span>
                  <select
                    value={voiceName}
                    onChange={(event) => {
                      setVoiceName(event.target.value);
                      saveVoicePrefs({ voiceName: event.target.value });
                    }}
                  >
                    <option value="">Automatique</option>
                    {voices.map((voice) => (
                      <option key={voice.name} value={voice.name}>
                        {voice.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="pron-field">
                  <span>Vitesse · {rate.toFixed(1)}×</span>
                  <input
                    type="range"
                    min={0.5}
                    max={1.3}
                    step={0.1}
                    value={rate}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      setRate(value);
                      saveVoicePrefs({ rate: value });
                    }}
                  />
                </label>
                {voices.length === 0 && (
                  <p className="pron-note">
                    Aucune voix italienne détectée : la lecture utilisera la voix par défaut. Sous Windows, ajoutez la voix « Italien » dans
                    Paramètres → Heure et langue → Voix.
                  </p>
                )}
              </details>

              <div>
                <p className="pron-label">{words.length ? 'Mots du cours' : 'Pour commencer'}</p>
                <div className="pron-chips">
                  {(words.length ? words : STARTERS).map((word) => (
                    <button key={word} type="button" className="pron-chip" onClick={() => choose(word)}>
                      {word}
                    </button>
                  ))}
                </div>
              </div>
              <p className="pron-hint">Astuce : sélectionnez n’importe quel passage du cours pour l’écouter.</p>
            </>
          )}
        </section>
      )}
    </>
  );
}
