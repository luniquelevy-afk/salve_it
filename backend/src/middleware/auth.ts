import type { Request, RequestHandler } from 'express';
import { env } from '../config/env.js';
import { HttpError } from '../lib/http-error.js';
import { supabaseAdmin } from '../lib/supabase.js';

export type AppRole = 'student' | 'teacher' | 'admin';

export interface AuthContext {
  userId: string;
  role: AppRole;
  aal: 'aal1' | 'aal2';
  mustChangePassword: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

// Appelé uniquement après auth.getUser(), qui a validé le jeton auprès de Supabase Auth :
// les claims décodés sont donc authentiques.
function readAal(jwt: string): AuthContext['aal'] {
  const payload = jwt.split('.')[1];
  if (!payload) return 'aal1';
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { aal?: string };
    return claims.aal === 'aal2' ? 'aal2' : 'aal1';
  } catch {
    return 'aal1';
  }
}

export function authOf(req: Request): AuthContext {
  if (!req.auth) throw new HttpError(401, 'unauthenticated', 'Authentification requise.');
  return req.auth;
}

export function isAdminMfaMissing(auth: AuthContext): boolean {
  return env.REQUIRE_ADMIN_MFA && auth.role === 'admin' && auth.aal !== 'aal2';
}

export const requireAuth: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
  if (!token) return next(new HttpError(401, 'unauthenticated', 'Authentification requise.'));

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return next(new HttpError(401, 'unauthenticated', 'Session invalide ou expirée.'));

  // Rôle et statut lus en base à chaque requête, jamais depuis le client (EF-03, EF-04).
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role, status, must_change_password')
    .eq('id', data.user.id)
    .single();

  if (profileError || !profile) return next(new HttpError(403, 'no_profile', 'Compte non configuré.'));
  if (profile.status !== 'active') {
    return next(new HttpError(403, 'account_suspended', 'Ce compte est suspendu. Contactez le centre.'));
  }

  req.auth = {
    userId: data.user.id,
    role: profile.role as AppRole,
    aal: readAal(token),
    mustChangePassword: Boolean(profile.must_change_password),
  };
  next();
};

export function requireRole(...roles: AppRole[]): RequestHandler {
  return (req, _res, next) => {
    const auth = authOf(req);
    if (!roles.includes(auth.role)) return next(new HttpError(403, 'forbidden', 'Accès refusé.'));
    next();
  };
}

export const requirePasswordChanged: RequestHandler = (req, _res, next) => {
  if (authOf(req).mustChangePassword) {
    return next(new HttpError(403, 'password_change_required', 'Vous devez changer votre mot de passe.'));
  }
  next();
};

export const requireAdminMfa: RequestHandler = (req, _res, next) => {
  if (isAdminMfaMissing(authOf(req))) {
    return next(new HttpError(403, 'mfa_required', 'Vérification en deux étapes requise.'));
  }
  next();
};

// Chaînes de gardes réutilisables par les routeurs.
export const signedIn: RequestHandler[] = [requireAuth, requirePasswordChanged, requireAdminMfa];
export const staffOnly: RequestHandler[] = [requireAuth, requirePasswordChanged, requireRole('teacher', 'admin'), requireAdminMfa];
export const adminOnly: RequestHandler[] = [requireAuth, requirePasswordChanged, requireRole('admin'), requireAdminMfa];
export const studentOnly: RequestHandler[] = [requireAuth, requirePasswordChanged, requireRole('student')];
