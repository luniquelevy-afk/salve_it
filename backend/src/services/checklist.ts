// Checklist administrative dynamique (§11.2, EF-47, EF-48, ENF-12).
import { HttpError } from '../lib/http-error.js';
import { db } from '../lib/db/index.js';
import { recordAudit } from './audit.js';

export type VisaType = 'etudes' | 'tourisme' | 'travail';
export type DocumentStatus = 'submitted' | 'needs_correction' | 'validated';

// §11.3 : mention obligatoire, affichée avec chaque checklist.
export const CHECKLIST_NOTICE =
  'Les informations administratives doivent être vérifiées sur le site officiel de l’ambassade d’Italie et de l’établissement concerné.';
const EXPIRY_WARNING_DAYS = 30;

export interface Requirement {
  id: string;
  code: string;
  label: string;
  description: string | null;
  documentType: string | null;
  visaTypes: VisaType[];
  financingSources: string[] | null;
  requiresGuarantor: boolean | null;
  sourceLabel: string | null;
  sourceUrl: string | null;
  lastVerifiedAt: string | null;
  requiresHumanVerification: boolean;
  displayOrder: number;
  isActive: boolean;
}

export interface ChecklistContext {
  visaType: VisaType | null;
  financingSource: string | null;
  hasGuarantor: boolean | null;
}

export interface DocumentSnapshot {
  id: string;
  status: DocumentStatus;
  expiresAt: string | null;
  currentVersion: number;
  reviewerComment: string | null;
  updatedAt: string;
}

export type ChecklistItemStatus = 'missing' | DocumentStatus | 'expired';

export function isApplicable(requirement: Requirement, context: ChecklistContext): boolean {
  if (!requirement.isActive) return false;
  // Sans type de visa connu : seulement les exigences communes à tous les visas.
  if (context.visaType ? !requirement.visaTypes.includes(context.visaType) : requirement.visaTypes.length < 3) return false;
  if (requirement.requiresGuarantor === true && !(context.hasGuarantor || context.financingSource === 'garant')) return false;
  if (requirement.financingSources && !(context.financingSource && requirement.financingSources.includes(context.financingSource))) return false;
  return true;
}

export function buildChecklist(requirements: Requirement[], context: ChecklistContext, documents: Map<string, DocumentSnapshot>, today: Date = new Date()) {
  const todayIso = today.toISOString().slice(0, 10);
  const warningIso = new Date(today.getTime() + EXPIRY_WARNING_DAYS * 86_400_000).toISOString().slice(0, 10);

  const items = requirements
    .filter((requirement) => isApplicable(requirement, context))
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((requirement) => {
      const document = requirement.documentType ? (documents.get(requirement.documentType) ?? null) : null;
      const expired = Boolean(document?.expiresAt && document.expiresAt < todayIso);
      const status: ChecklistItemStatus = !document ? 'missing' : expired ? 'expired' : document.status;
      return {
        code: requirement.code,
        label: requirement.label,
        description: requirement.description,
        documentType: requirement.documentType,
        status,
        document,
        expiringSoon: Boolean(document?.expiresAt && !expired && document.expiresAt <= warningIso),
        sourceLabel: requirement.sourceLabel,
        sourceUrl: requirement.sourceUrl,
        lastVerifiedAt: requirement.lastVerifiedAt,
        requiresHumanVerification: requirement.requiresHumanVerification,
      };
    });

  const verifiedDates = items.map((item) => item.lastVerifiedAt).filter((value): value is string => Boolean(value));
  return {
    visaType: context.visaType,
    items,
    progress: { validated: items.filter((item) => item.status === 'validated').length, total: items.length },
    // La date la plus ancienne : la checklist n'est pas plus fiable que sa source la moins récente.
    oldestVerificationAt: verifiedDates.length === items.length && items.length > 0 ? verifiedDates.sort()[0]! : null,
    unverifiedCount: items.filter((item) => !item.lastVerifiedAt).length,
    notice: CHECKLIST_NOTICE,
  };
}

// ─────────────────────────────────────────────────────────────
// Référentiel (admin)
// ─────────────────────────────────────────────────────────────

const REQUIREMENT_COLUMNS =
  'id, code, label, description, document_type, visa_types, financing_sources, requires_guarantor, source_label, source_url, last_verified_at, requires_human_verification, display_order, is_active, updated_at';

export function toRequirement(row: Record<string, unknown>): Requirement {
  return {
    id: row.id as string,
    code: row.code as string,
    label: row.label as string,
    description: row.description as string | null,
    documentType: row.document_type as string | null,
    visaTypes: row.visa_types as VisaType[],
    financingSources: row.financing_sources as string[] | null,
    requiresGuarantor: row.requires_guarantor as boolean | null,
    sourceLabel: row.source_label as string | null,
    sourceUrl: row.source_url as string | null,
    lastVerifiedAt: row.last_verified_at as string | null,
    requiresHumanVerification: row.requires_human_verification as boolean,
    displayOrder: row.display_order as number,
    isActive: row.is_active as boolean,
  };
}

export async function listRequirements(onlyActive: boolean): Promise<Requirement[]> {
  let query = db.from('checklist_requirements').select(REQUIREMENT_COLUMNS);
  if (onlyActive) query = query.eq('is_active', true);
  const { data, error } = await query.order('display_order');
  if (error) throw error;
  return (data as Record<string, unknown>[]).map(toRequirement);
}

export async function listDocumentTypes() {
  const { data, error } = await db.from('document_types').select('code, label, description, requires_expiry, display_order').eq('is_active', true).order('display_order');
  if (error) throw error;
  return (data as { code: string; label: string; description: string | null; requires_expiry: boolean }[]).map((row) => ({
    code: row.code,
    label: row.label,
    description: row.description,
    requiresExpiry: row.requires_expiry,
  }));
}

export interface RequirementInput {
  code: string;
  label: string;
  description?: string | null | undefined;
  documentType?: string | null | undefined;
  visaTypes: VisaType[];
  financingSources?: string[] | null | undefined;
  requiresGuarantor?: boolean | null | undefined;
  sourceLabel?: string | null | undefined;
  sourceUrl?: string | null | undefined;
  requiresHumanVerification: boolean;
  displayOrder: number;
  isActive: boolean;
}

function requirementRow(input: RequirementInput, actorId: string) {
  return {
    code: input.code,
    label: input.label,
    description: input.description || null,
    document_type: input.documentType || null,
    visa_types: input.visaTypes,
    financing_sources: input.financingSources?.length ? input.financingSources : null,
    requires_guarantor: input.requiresGuarantor ?? null,
    source_label: input.sourceLabel || null,
    source_url: input.sourceUrl || null,
    requires_human_verification: input.requiresHumanVerification,
    display_order: input.displayOrder,
    is_active: input.isActive,
    updated_by: actorId,
  };
}

export async function createRequirement(actorId: string, input: RequirementInput) {
  const { data, error } = await db.from('checklist_requirements').insert(requirementRow(input, actorId)).select(REQUIREMENT_COLUMNS).single();
  if (error?.code === '23505') throw new HttpError(409, 'requirement_code_taken', 'Ce code existe déjà.');
  if (error) throw error;
  await recordAudit({ actorId, action: 'checklist_requirement.create', entityType: 'checklist_requirement', entityId: data.id });
  return toRequirement(data);
}

// Une modification du contenu invalide la date de vérification : elle doit être revérifiée.
export async function updateRequirement(actorId: string, id: string, input: RequirementInput) {
  const { data, error } = await db
    .from('checklist_requirements')
    .update({ ...requirementRow(input, actorId), last_verified_at: null })
    .eq('id', id)
    .select(REQUIREMENT_COLUMNS)
    .maybeSingle();
  if (error?.code === '23505') throw new HttpError(409, 'requirement_code_taken', 'Ce code existe déjà.');
  if (error) throw error;
  if (!data) throw new HttpError(404, 'requirement_not_found', 'Exigence introuvable.');
  await recordAudit({ actorId, action: 'checklist_requirement.update', entityType: 'checklist_requirement', entityId: id });
  return toRequirement(data);
}

// EF-48 : le centre atteste avoir vérifié l'exigence sur la source officielle à cette date.
export async function markRequirementVerified(actorId: string, id: string, verifiedOn: string) {
  const { data, error } = await db
    .from('checklist_requirements')
    .update({ last_verified_at: verifiedOn, updated_by: actorId })
    .eq('id', id)
    .select(REQUIREMENT_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'requirement_not_found', 'Exigence introuvable.');
  await recordAudit({ actorId, action: 'checklist_requirement.verify', entityType: 'checklist_requirement', entityId: id, metadata: { verifiedOn } });
  return toRequirement(data);
}
