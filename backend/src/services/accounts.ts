import { randomBytes, randomUUID } from 'node:crypto';
import { firebaseAuth } from '../lib/firebase.js';
import { HttpError } from '../lib/http-error.js';
import { db } from '../lib/db/index.js';
import type { AppRole } from '../middleware/auth.js';
import { recordAudit } from './audit.js';

export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2';
export type AccountStatus = 'active' | 'suspended';

export interface Account {
  id: string;
  email: string;
  role: AppRole;
  fullName: string;
  phone: string | null;
  level: CefrLevel | null;
  status: AccountStatus;
  mustChangePassword: boolean;
  createdAt: string;
}

interface ProfileRow {
  id: string;
  email: string;
  role: AppRole;
  full_name: string;
  phone: string | null;
  level: CefrLevel | null;
  status: AccountStatus;
  must_change_password: boolean;
  created_at: string;
}

const PROFILE_COLUMNS = 'id, email, role, full_name, phone, level, status, must_change_password, created_at';

const authErrorCode = (error: unknown) => (error as { code?: string } | null)?.code;

function toAccount(row: ProfileRow): Account {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    fullName: row.full_name,
    phone: row.phone,
    level: row.level,
    status: row.status,
    mustChangePassword: row.must_change_password,
    createdAt: row.created_at,
  };
}

// ~96 bits d'entropie ; montré une seule fois à l'admin, à changer dès la 1re connexion (EF-02).
export function generateTemporaryPassword(): string {
  return randomBytes(12).toString('base64url');
}

export interface CreateAccountInput {
  email: string;
  fullName: string;
  role: AppRole;
  phone?: string | undefined;
  level?: CefrLevel | undefined;
}

export async function createAccount(input: CreateAccountInput, actorId: string | null) {
  const email = input.email.trim().toLowerCase();
  const temporaryPassword = generateTemporaryPassword();

  let uid: string;
  try {
    // uid UUID explicite : les identifiants de comptes restent des UUID dans toute l'API.
    ({ uid } = await firebaseAuth.createUser({ uid: randomUUID(), email, password: temporaryPassword, emailVerified: true }));
  } catch (error) {
    if (authErrorCode(error) === 'auth/email-already-exists') {
      throw new HttpError(409, 'email_exists', 'Un compte existe déjà avec cet email.');
    }
    throw error;
  }

  const { data: row, error: insertError } = await db
    .from('profiles')
    .insert({
      id: uid,
      email,
      role: input.role,
      full_name: input.fullName,
      phone: input.phone || null,
      level: input.role === 'student' ? (input.level ?? null) : null,
      created_by: actorId,
    })
    .select(PROFILE_COLUMNS)
    .single();

  if (insertError || !row) {
    // Pas de compte Auth orphelin sans profil.
    await firebaseAuth.deleteUser(uid);
    throw insertError ?? new Error('insert profile: aucune ligne retournée');
  }

  const account = toAccount(row as ProfileRow);
  await recordAudit({ actorId, action: 'account.create', entityType: 'profile', entityId: account.id, metadata: { role: account.role } });
  return { account, temporaryPassword };
}

export async function listAccounts(role?: AppRole): Promise<Account[]> {
  let query = db.from('profiles').select(PROFILE_COLUMNS).order('created_at', { ascending: false });
  if (role) query = query.eq('role', role);
  const { data, error } = await query;
  if (error) throw error;
  return (data as ProfileRow[]).map(toAccount);
}

export async function getAccount(id: string): Promise<Account> {
  const { data, error } = await db.from('profiles').select(PROFILE_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'account_not_found', 'Compte introuvable.');
  return toAccount(data as ProfileRow);
}

export interface UpdateAccountInput {
  fullName?: string | undefined;
  phone?: string | null | undefined;
  level?: CefrLevel | null | undefined;
}

export async function updateAccount(id: string, patch: UpdateAccountInput, actorId: string): Promise<Account> {
  const current = await getAccount(id);
  if (patch.level && current.role !== 'student') {
    throw new HttpError(400, 'level_only_for_students', 'Le niveau ne concerne que les étudiants.');
  }

  const changes: Record<string, unknown> = {};
  if (patch.fullName !== undefined) changes.full_name = patch.fullName;
  if (patch.phone !== undefined) changes.phone = patch.phone || null;
  if (patch.level !== undefined) changes.level = patch.level;
  if (Object.keys(changes).length === 0) return current;

  const { data, error } = await db.from('profiles').update(changes).eq('id', id).select(PROFILE_COLUMNS).single();
  if (error) throw error;
  await recordAudit({ actorId, action: 'account.update', entityType: 'profile', entityId: id, metadata: { fields: Object.keys(changes) } });
  return toAccount(data as ProfileRow);
}

export async function setAccountStatus(id: string, status: AccountStatus, actorId: string): Promise<Account> {
  if (id === actorId) throw new HttpError(400, 'cannot_change_own_status', 'Vous ne pouvez pas modifier le statut de votre propre compte.');
  await getAccount(id);

  // Profil d'abord : le middleware coupe l'accès immédiatement (EF-03),
  // puis la désactivation Auth empêche toute nouvelle connexion et révoque les sessions en cours.
  const { data, error } = await db.from('profiles').update({ status }).eq('id', id).select(PROFILE_COLUMNS).single();
  if (error) throw error;

  await firebaseAuth.updateUser(id, { disabled: status === 'suspended' });
  if (status === 'suspended') await firebaseAuth.revokeRefreshTokens(id);

  await recordAudit({ actorId, action: status === 'suspended' ? 'account.suspend' : 'account.reactivate', entityType: 'profile', entityId: id });
  return toAccount(data as ProfileRow);
}

export async function resetTemporaryPassword(id: string, actorId: string) {
  await getAccount(id);
  const temporaryPassword = generateTemporaryPassword();

  await firebaseAuth.updateUser(id, { password: temporaryPassword });

  const { data, error: updateError } = await db
    .from('profiles')
    .update({ must_change_password: true })
    .eq('id', id)
    .select(PROFILE_COLUMNS)
    .single();
  if (updateError) throw updateError;

  await recordAudit({ actorId, action: 'account.reset_password', entityType: 'profile', entityId: id });
  return { account: toAccount(data as ProfileRow), temporaryPassword };
}

export async function completePasswordChange(userId: string, password: string): Promise<void> {
  // Firebase révoque les sessions à chaque changement de mot de passe : le frontend se reconnecte ensuite.
  try {
    await firebaseAuth.updateUser(userId, { password });
  } catch (error) {
    if (authErrorCode(error) === 'auth/invalid-password') throw new HttpError(400, 'weak_password', 'Mot de passe trop faible.');
    throw error;
  }

  const { error: updateError } = await db.from('profiles').update({ must_change_password: false }).eq('id', userId);
  if (updateError) throw updateError;

  await recordAudit({ actorId: userId, action: 'account.password_changed', entityType: 'profile', entityId: userId });
}
