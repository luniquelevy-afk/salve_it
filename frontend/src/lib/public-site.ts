import { useOutletContext } from 'react-router-dom';
import type { PublicSite } from './types';

export interface PublicSiteContext {
  site: PublicSite | null;
  failed: boolean;
}

export function usePublicSite(): PublicSiteContext {
  return useOutletContext<PublicSiteContext>();
}

export function whatsappLink(number: string): string {
  return `https://wa.me/${number.replace(/\D/g, '')}`;
}
