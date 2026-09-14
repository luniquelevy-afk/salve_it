import type { Session } from '@supabase/supabase-js';
import { createContext, useContext } from 'react';
import type { Me } from '../lib/types';

export interface AuthContextValue {
  session: Session | null;
  me: Me | null;
  loading: boolean;
  notice: string | null;
  refreshMe: () => Promise<void>;
  signOut: (notice?: string) => Promise<void>;
  clearNotice: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth doit être utilisé dans <AuthProvider>.');
  return context;
}
