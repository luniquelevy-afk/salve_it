import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Liens profonds du menu et des actions rapides (#programmes, #publier) : fait défiler jusqu'à
// la section visée et place le curseur dans son premier champ, une fois la page chargée.
export function useScrollToHash(ready = true) {
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash || !ready) return;
    const target = document.getElementById(decodeURIComponent(hash.slice(1)));
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    target.querySelector<HTMLElement>('input, textarea, select')?.focus({ preventScroll: true });
  }, [hash, ready]);
}
