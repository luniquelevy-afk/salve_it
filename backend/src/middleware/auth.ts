import type { Request, RequestHandler } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { env } from '../config/env.js';
import { db } from '../lib/db/index.js';
import { firebaseAuth } from '../lib/firebase.js';
import { HttpError } from '../lib/http-error.js';

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

// « aal2 » lorsque la connexion a validé un second facteur (claim posé par Firebase Auth
// dans un jeton dont la signature vient d'être vérifiée).
function readAal(claims: DecodedIdToken): AuthContext['aal'] {
  return claims.firebase.sign_in_second_factor ? 'aal2' : 'aal1';
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

  // checkRevoked : refuse aussi les jetons d'un compte désactivé ou dont les sessions ont été révoquées.
  let claims: DecodedIdToken;
  try {
    claims = await firebaseAuth.verifyIdToken(token, true);
  } catch (error) {
    if ((error as { code?: string }).code === 'auth/user-disabled') {
      return next(new HttpError(403, 'account_suspended', 'Ce compte est suspendu. Contactez le centre.'));
    }
    return next(new HttpError(401, 'unauthenticated', 'Session invalide ou expirée.'));
  }

  // Rôle et statut lus en base à chaque requête, jamais depuis le client (EF-03, EF-04).
  const { data: profile, error: profileError } = await db
    .from('profiles')
    .select('role, status, must_change_password')
    .eq('id', claims.uid)
    .single();

  if (profileError || !profile) return next(new HttpError(403, 'no_profile', 'Compte non configuré.'));
  if (profile.status !== 'active') {
    return next(new HttpError(403, 'account_suspended', 'Ce compte est suspendu. Contactez le centre.'));
  }

  req.auth = {
    userId: claims.uid,
    role: profile.role as AppRole,
    aal: readAal(claims),
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
