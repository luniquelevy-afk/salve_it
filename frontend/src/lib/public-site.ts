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

// Coordonnées du centre affichées si le contenu administrable ne répond pas (backend en veille) :
// jamais de numéro fictif. Le contenu de /admin/site reste prioritaire.
export const CENTRE_CONTACT = {
  phone: '+242 06 673 3974',
  whatsapp: '+242 06 673 3974',
  email: 'info.salveitalia@gmail.com',
};
