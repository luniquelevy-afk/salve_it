import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

// Client service role : contourne la RLS. Réservé au backend, pour des opérations
// précises (création de compte, suspension…) toujours tracées dans audit_logs (CDC §18).
export const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
