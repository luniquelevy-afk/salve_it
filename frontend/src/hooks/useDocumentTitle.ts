import { useEffect } from 'react';

export function useDocumentTitle(title: string | null | undefined, siteName = 'Salve Italia') {
  useEffect(() => {
    document.title = title ? `${title} — ${siteName}` : siteName;
  }, [title, siteName]);
}
