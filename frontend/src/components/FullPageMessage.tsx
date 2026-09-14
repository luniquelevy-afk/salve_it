import type { ReactNode } from 'react';

export function FullPageMessage({ title, message, children }: { title: string; message?: string; children?: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="card max-w-md text-center">
        <h1 className="text-lg font-semibold">{title}</h1>
        {message && <p className="mt-2 text-sm text-stone-600">{message}</p>}
        {children && <div className="mt-4">{children}</div>}
      </div>
    </main>
  );
}
