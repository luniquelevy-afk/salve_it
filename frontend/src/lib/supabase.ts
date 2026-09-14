import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY sont requis (voir frontend/.env.example).');
}

// Client Supabase uniquement : aucune logique ni clé IA côté frontend (CDC §17.2).
// sessionStorage : la session ne survit pas à la fermeture de l'onglet — pas de
// « se souvenir de moi » par défaut sur des postes potentiellement partagés.
export const supabase = createClient(url, anonKey, {
  auth: { persistSession: true, storage: window.sessionStorage },
});
