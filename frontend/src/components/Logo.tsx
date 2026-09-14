export function Logo({ className = '', name = 'Salve Italia' }: { className?: string; name?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-bold tracking-tight ${className}`}>
      <span aria-hidden className="flex h-5 overflow-hidden rounded-sm">
        <span className="w-2 bg-verde" />
        <span className="w-2 bg-white ring-1 ring-stone-200 ring-inset" />
        <span className="w-2 bg-rosso" />
      </span>
      {name}
    </span>
  );
}
