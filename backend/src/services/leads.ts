// Prospects (EF-32, EF-60 à EF-63).
import { HttpError } from '../lib/http-error.js';
import { supabaseAdmin } from '../lib/supabase.js';
import type { CefrLevel } from './access.js';
import { recordAudit } from './audit.js';

export const LEAD_STATUSES = ['nouveau', 'contacte', 'test_realise', 'interesse', 'inscrit', 'non_interesse', 'a_relancer'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const INTERACTION_KINDS = ['appel', 'whatsapp', 'email', 'rendez_vous', 'note'] as const;
export type InteractionKind = (typeof INTERACTION_KINDS)[number] | 'changement_statut' | 'assignation';

export interface NewLead {
  fullName: string;
  phone?: string | undefined;
  email?: string | undefined;
  desiredProgram?: string | undefined;
  levelEstimate?: CefrLevel | null | undefined;
  message?: string | undefined;
  source: 'contact_form' | 'level_test';
}

// Appelé uniquement après consentement explicite de la personne.
export async function createLead(lead: NewLead): Promise<void> {
  const { error } = await supabaseAdmin.from('leads').insert({
    full_name: lead.fullName,
    phone: lead.phone || null,
    email: lead.email || null,
    desired_program: lead.desiredProgram || null,
    level_estimate: lead.levelEstimate ?? null,
    message: lead.message || null,
    source: lead.source,
    contact_consent: true,
  });
  if (error?.code === '23514') throw new HttpError(400, 'contact_required', 'Indiquez un téléphone ou un email.');
  if (error) throw error;
}

const LEAD_COLUMNS =
  'id, full_name, phone, email, desired_program, level_estimate, message, source, status, notes, next_follow_up_at, assigned_to, created_at, updated_at, assignee:profiles!leads_assigned_to_fkey(full_name)';

function toLead(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    fullName: row.full_name as string,
    phone: row.phone as string | null,
    email: row.email as string | null,
    desiredProgram: row.desired_program as string | null,
    levelEstimate: row.level_estimate as CefrLevel | null,
    message: row.message as string | null,
    source: row.source as NewLead['source'],
    status: row.status as LeadStatus,
    notes: row.notes as string | null,
    nextFollowUpAt: row.next_follow_up_at as string | null,
    assignedTo: row.assigned_to ? { id: row.assigned_to as string, fullName: (row.assignee as { full_name: string } | null)?.full_name ?? '' } : null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

async function logInteraction(leadId: string, actorId: string, kind: InteractionKind, summary: string) {
  const { error } = await supabaseAdmin.from('lead_interactions').insert({ lead_id: leadId, actor_id: actorId, kind, summary });
  if (error) throw error;
}

export async function listLeads(filters: { status?: LeadStatus | undefined; assignedTo?: string | undefined }) {
  let query = supabaseAdmin.from('leads').select(LEAD_COLUMNS).order('created_at', { ascending: false }).limit(500);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.assignedTo) query = query.eq('assigned_to', filters.assignedTo);
  const { data, error } = await query;
  if (error) throw error;
  return (data as unknown as Record<string, unknown>[]).map(toLead);
}

async function loadLead(id: string) {
  const { data, error } = await supabaseAdmin.from('leads').select(LEAD_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'lead_not_found', 'Prospect introuvable.');
  return toLead(data as unknown as Record<string, unknown>);
}

export async function updateLead(
  actorId: string,
  id: string,
  patch: { status?: LeadStatus | undefined; notes?: string | null | undefined; nextFollowUpAt?: string | null | undefined },
) {
  const current = await loadLead(id);
  const { error } = await supabaseAdmin
    .from('leads')
    .update({
      ...(patch.status !== undefined && { status: patch.status }),
      ...(patch.notes !== undefined && { notes: patch.notes || null }),
      ...(patch.nextFollowUpAt !== undefined && { next_follow_up_at: patch.nextFollowUpAt }),
    })
    .eq('id', id);
  if (error) throw error;

  // EF-63 : les changements de statut et de relance alimentent l'historique.
  if (patch.status !== undefined && patch.status !== current.status) {
    await logInteraction(id, actorId, 'changement_statut', `Statut : ${current.status} → ${patch.status}`);
  }
  if (patch.nextFollowUpAt !== undefined && patch.nextFollowUpAt !== current.nextFollowUpAt) {
    await logInteraction(
      id,
      actorId,
      'note',
      patch.nextFollowUpAt ? `Relance programmée le ${new Date(patch.nextFollowUpAt).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}` : 'Relance annulée',
    );
  }
  await recordAudit({ actorId, action: 'lead.update', entityType: 'lead', entityId: id, metadata: { fields: Object.keys(patch) } });
  return loadLead(id);
}

// EF-61 : affectation à un responsable (admin ou enseignant actif).
export async function assignLead(actorId: string, id: string, assigneeId: string | null) {
  const current = await loadLead(id);
  let assigneeName: string | null = null;
  if (assigneeId) {
    const { data, error } = await supabaseAdmin.from('profiles').select('full_name, role, status').eq('id', assigneeId).maybeSingle();
    if (error) throw error;
    if (!data || data.status !== 'active' || !['admin', 'teacher'].includes(data.role as string)) {
      throw new HttpError(400, 'assignee_invalid', 'Le responsable doit être un membre actif de l’équipe.');
    }
    assigneeName = data.full_name as string;
  }

  const { error } = await supabaseAdmin.from('leads').update({ assigned_to: assigneeId }).eq('id', id);
  if (error) throw error;
  if ((current.assignedTo?.id ?? null) !== assigneeId) {
    await logInteraction(id, actorId, 'assignation', assigneeName ? `Affecté à ${assigneeName}` : 'Affectation retirée');
  }
  await recordAudit({ actorId, action: 'lead.assign', entityType: 'lead', entityId: id });
  return loadLead(id);
}

export async function addLeadInteraction(actorId: string, id: string, input: { kind: (typeof INTERACTION_KINDS)[number]; summary: string }) {
  await loadLead(id);
  await logInteraction(id, actorId, input.kind, input.summary);
  return listLeadInteractions(id);
}

export async function listLeadInteractions(id: string) {
  const { data, error } = await supabaseAdmin
    .from('lead_interactions')
    .select('id, kind, summary, created_at, actor:profiles!lead_interactions_actor_id_fkey(full_name)')
    .eq('lead_id', id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as Record<string, unknown>[]).map((row) => ({
    id: row.id as string,
    kind: row.kind as InteractionKind,
    summary: row.summary as string,
    actorName: (row.actor as { full_name: string } | null)?.full_name ?? null,
    createdAt: row.created_at as string,
  }));
}

export async function listLeadAssignees() {
  const { data, error } = await supabaseAdmin.from('profiles').select('id, full_name, role').in('role', ['admin', 'teacher']).eq('status', 'active').order('full_name');
  if (error) throw error;
  return (data as { id: string; full_name: string; role: string }[]).map((row) => ({ id: row.id, fullName: row.full_name, role: row.role }));
}
