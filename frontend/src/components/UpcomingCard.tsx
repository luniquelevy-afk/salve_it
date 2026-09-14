import { Link } from 'react-router-dom';

export function UpcomingCard({ title, description, phase, to }: { title: string; description: string; phase?: string; to?: string }) {
  const content = (
    <>
      <div className="mb-2 flex items-start justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>
        {phase && <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">{phase}</span>}
        {to && <span aria-hidden className="text-verde">→</span>}
      </div>
      <p className="text-sm text-stone-600">{description}</p>
    </>
  );

  return to ? (
    <Link to={to} className="card block transition hover:border-verde/40 hover:shadow-md">
      {content}
    </Link>
  ) : (
    <div className="card">{content}</div>
  );
}
