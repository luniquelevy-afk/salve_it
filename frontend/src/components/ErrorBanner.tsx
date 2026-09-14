export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg bg-rosso/5 px-3 py-2 text-sm text-rosso">
      {message}
    </p>
  );
}
