import { randomBytes } from 'node:crypto';
import { HttpError } from '../lib/http-error.js';
import { supabaseAdmin } from '../lib/supabase.js';
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

// Durée de bannissement Supabase Auth équivalente à « indéfiniment ».
const BAN_INDEFINITELY = '876000h';

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

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
    app_metadata: { role: input.role },
  });
  if (error?.code === 'email_exists') {
    throw new HttpError(409, 'email_exists', 'Un compte existe déjà avec cet email.');
  }
  if (error || !data.user) throw error ?? new Error('createUser: aucun utilisateur retourné');

  const { data: row, error: insertError } = await supabaseAdmin
    .from('profiles')
    .insert({
      id: data.user.id,
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
    await supabaseAdmin.auth.admin.deleteUser(data.user.id);
    throw insertError ?? new Error('insert profile: aucune ligne retournée');
  }

  const account = toAccount(row as ProfileRow);
  await recordAudit({ actorId, action: 'account.create', entityType: 'profile', entityId: account.id, metadata: { role: account.role } });
  return { account, temporaryPassword };
}

export async function listAccounts(role?: AppRole): Promise<Account[]> {
  let query = supabaseAdmin.from('profiles').select(PROFILE_COLUMNS).order('created_at', { ascending: false });
  if (role) query = query.eq('role', role);
  const { data, error } = await query;
  if (error) throw error;
  return (data as ProfileRow[]).map(toAccount);
}

export async function getAccount(id: string): Promise<Account> {
  const { data, error } = await supabaseAdmin.from('profiles').select(PROFILE_COLUMNS).eq('id', id).maybeSingle();
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

  const { data, error } = await supabaseAdmin.from('profiles').update(changes).eq('id', id).select(PROFILE_COLUMNS).single();
  if (error) throw error;
  await recordAudit({ actorId, action: 'account.update', entityType: 'profile', entityId: id, metadata: { fields: Object.keys(changes) } });
  return toAccount(data as ProfileRow);
}

export async function setAccountStatus(id: string, status: AccountStatus, actorId: string): Promise<Account> {
  if (id === actorId) throw new HttpError(400, 'cannot_change_own_status', 'Vous ne pouvez pas modifier le statut de votre propre compte.');
  await getAccount(id);

  // Profil d'abord : la RLS et le middleware coupent l'accès immédiatement (EF-03),
  // puis le bannissement Auth empêche toute nouvelle connexion ou rafraîchissement de session.
  const { data, error } = await supabaseAdmin.from('profiles').update({ status }).eq('id', id).select(PROFILE_COLUMNS).single();
  if (error) throw error;

  const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(id, {
    ban_duration: status === 'suspended' ? BAN_INDEFINITELY : 'none',
  });
  if (banError) throw banError;

  await recordAudit({ actorId, action: status === 'suspended' ? 'account.suspend' : 'account.reactivate', entityType: 'profile', entityId: id });
  return toAccount(data as ProfileRow);
}

export async function resetTemporaryPassword(id: string, actorId: string) {
  await getAccount(id);
  const temporaryPassword = generateTemporaryPassword();

  const { error } = await supabaseAdmin.auth.admin.updateUserById(id, { password: temporaryPassword });
  if (error) throw error;

  const { data, error: updateError } = await supabaseAdmin
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
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
  if (error?.code === 'weak_password') {
    throw new HttpError(400, 'weak_password', 'Mot de passe trop faible.');
  }
  if (error) throw error;

  const { error: updateError } = await supabaseAdmin.from('profiles').update({ must_change_password: false }).eq('id', userId);
  if (updateError) throw updateError;

  await recordAudit({ actorId: userId, action: 'account.password_changed', entityType: 'profile', entityId: userId });
}
