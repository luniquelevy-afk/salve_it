import { useCallback, useEffect, useRef, useState } from 'react';

// Web Speech API : non typée dans lib.dom et inégalement supportée (Chrome oui, Safari/Firefox partiel) — ENF-04.
interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly 0: { readonly transcript: string };
}

interface SpeechRecognitionEventLike {
  readonly resultIndex: number;
  readonly results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getRecognitionConstructor(): SpeechRecognitionConstructor | null {
  const speechWindow = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

export const speechSupport = {
  recognition: () => getRecognitionConstructor() !== null,
  synthesis: () => typeof window !== 'undefined' && 'speechSynthesis' in window,
};

export const RECOGNITION_ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': 'Accès au micro refusé. Autorisez le micro dans votre navigateur ou répondez par écrit.',
  'audio-capture': 'Aucun micro détecté. Vérifiez votre micro ou répondez par écrit.',
  network: 'La reconnaissance vocale nécessite une connexion internet. Répondez par écrit si le problème persiste.',
  'no-speech': 'Aucune parole détectée. Réessayez en parlant plus près du micro.',
};

export function useSpeechRecognition(onFinalText: (text: string) => void, lang = 'fr-FR') {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onFinalRef = useRef(onFinalText);
  onFinalRef.current = onFinalText;

  const start = useCallback(() => {
    const Recognition = getRecognitionConstructor();
    if (!Recognition) {
      setError('unsupported');
      return;
    }
    recognitionRef.current?.abort();
    const recognition = new Recognition();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let finalText = '';
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i]!;
        if (result.isFinal) finalText += result[0].transcript;
        else interimText += result[0].transcript;
      }
      if (finalText.trim()) onFinalRef.current(finalText.trim());
      setInterim(interimText);
    };
    recognition.onerror = (event) => {
      if (event.error !== 'aborted') setError(event.error);
    };
    recognition.onend = () => {
      setListening(false);
      setInterim('');
    };
    recognitionRef.current = recognition;
    setError(null);
    recognition.start();
    setListening(true);
  }, [lang]);

  const stop = useCallback(() => recognitionRef.current?.stop(), []);

  useEffect(() => () => recognitionRef.current?.abort(), []);

  return { listening, interim, error, start, stop };
}

export function speak(text: string, onEnd?: () => void, lang = 'fr-FR') {
  if (!speechSupport.synthesis()) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  const voice = window.speechSynthesis.getVoices().find((candidate) => candidate.lang.toLowerCase().startsWith(lang.slice(0, 2)));
  if (voice) utterance.voice = voice;
  utterance.onend = () => onEnd?.();
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if (speechSupport.synthesis()) window.speechSynthesis.cancel();
}

// EF-16 : vérification des permissions micro avant de lancer un entretien vocal.
export async function checkMicrophone(): Promise<'granted' | 'denied' | 'unavailable'> {
  if (!navigator.mediaDevices?.getUserMedia) return 'unavailable';
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return 'granted';
  } catch (err) {
    return err instanceof DOMException && err.name === 'NotAllowedError' ? 'denied' : 'unavailable';
  }
}
