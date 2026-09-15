// Marque : une arche / portail académique (« Salve » = le seuil que l'on franchit),
// en currentColor pour rester lisible sur toiles claires comme sur le bleu nuit.
// Aucune rayure drapeau ni cliché touristique (parti pris « Warm Institutional Modernism »).
export function Logo({ className = '', name = 'Salve Italia' }: { className?: string; name?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-bold tracking-tight ${className}`}>
      <span aria-hidden className="inline-grid size-7 place-items-center rounded-md ring-1 ring-current/25">
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 20v-8a8 8 0 0 1 16 0v8" />
          <path d="M9 20v-7a3 3 0 0 1 6 0v7" />
        </svg>
      </span>
      {name}
    </span>
  );
}
