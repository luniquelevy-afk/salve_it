import logoMark from '../assets/landing/logo.png';

// Marque officielle du centre « Salve Italia ! ». L'emblème (deux diplômés, étoile,
// branche d'olivier, cercle) comporte des traits fins : on le pose sur une pastille
// blanche pour qu'il reste lisible aussi bien sur fond clair que sur le thème sombre.
// Le nom reste en texte à côté (l'emblème est trop détaillé pour être lu en petit).
export function Logo({ className = '', name = 'Salve Italia' }: { className?: string; name?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-bold tracking-tight ${className}`}>
      <span aria-hidden className="inline-grid size-8 place-items-center rounded-lg bg-white p-1 shadow-sm ring-1 ring-black/5">
        <img src={logoMark} alt="" className="size-full object-contain" />
      </span>
      {name}
    </span>
  );
}
