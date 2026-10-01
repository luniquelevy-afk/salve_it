import { speakItalian, stopItalian, synthesisSupported, usePlayingId, SLOW_RATE } from '../../lib/italian-voice';

interface SpeakButtonProps {
  text: string | string[];
  id: string;
  label?: string;
  // Bouton compact (icône seule) dans les tableaux et les répliques.
  compact?: boolean;
  slow?: boolean;
}

export function SpeakButton({ text, id, label, compact = true, slow = false }: SpeakButtonProps) {
  const playingId = usePlayingId();
  if (!synthesisSupported()) return null;
  const active = playingId === id;
  const spoken = Array.isArray(text) ? text.join(' ') : text;
  const toggle = () => (active ? stopItalian() : speakItalian(text, { id, ...(slow && { rate: SLOW_RATE }) }));

  if (compact) {
    return (
      <button
        type="button"
        onClick={toggle}
        className={`speak-btn ${active ? 'is-playing' : ''}`}
        aria-label={active ? 'Arrêter la lecture' : `Écouter « ${spoken.slice(0, 60)} »`}
        title={active ? 'Arrêter' : 'Écouter la prononciation'}
      >
        <span aria-hidden="true">{active ? '■' : '🔊'}</span>
      </button>
    );
  }
  return (
    <button type="button" onClick={toggle} className={`speak-pill ${active ? 'is-playing' : ''}`}>
      <span aria-hidden="true">{active ? '■' : slow ? '🐢' : '▶'}</span>
      {active ? 'Arrêter' : label}
    </button>
  );
}
