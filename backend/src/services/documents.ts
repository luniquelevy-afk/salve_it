// Espace documentaire étudiant (§11.1, EF-44 à EF-46) — suivi interne, jamais une validation officielle.
import { randomUUID } from 'node:crypto';
import { HttpError } from '../lib/http-error.js';
import { logger } from '../lib/logger.js';
import { supabaseAdmin } from '../lib/supabase.js';
import type { AuthContext } from '../middleware/auth.js';
import { recordAudit } from './audit.js';
import { buildChecklist, listDocumentTypes, listRequirements, type DocumentSnapshot, type DocumentStatus, type VisaType } from './checklist.js';
import {
  detectDocumentMimeType,
  DOCUMENT_BUCKET,
  DOCUMENT_MIME_EXTENSIONS,
  MAX_DOCUMENT_BYTES,
  sanitizeDocumentFileName,
  SIGNED_URL_SECONDS,
} from './document-files.js';
import { notifySafely } from './notifications.js';
import { assertCanFollowStudent } from './access.js';

interface DocumentRow {
  id: string;
  student_id: string;
  document_type: string;
  status: DocumentStatus;
  current_version: number;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  expires_at: string | null;
  reviewer_comment: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  document_types: { label: string; requires_expiry: boolean } | null;
  reviewer: { full_name: string } | null;
}

const DOCUMENT_COLUMNS =
  'id, student_id, document_type, status, current_version, storage_path, file_name, mime_type, size_bytes, expires_at, reviewer_comment, reviewed_at, created_at, updated_at, document_types(label, requires_expiry), reviewer:profiles!student_documents_reviewed_by_fkey(full_name)';

export async function ensureDocumentBucket(): Promise<void> {
  const { data, error } = await supabaseAdmin.storage.getBucket(DOCUMENT_BUCKET);
  if (data && !error) {
    if (data.public) logger.error({ bucket: DOCUMENT_BUCKET }, 'document_bucket_is_public');
    return;
  }
  const { error: createError } = await supabaseAdmin.storage.createBucket(DOCUMENT_BUCKET, {
    public: false,
    fileSizeLimit: MAX_DOCUMENT_BYTES,
    allowedMimeTypes: Object.keys(DOCUMENT_MIME_EXTENSIONS),
  });
  if (createError) logger.error({ err: createError }, 'document_bucket_create_failed');
}

function toDocument(row: DocumentRow) {
  return {
    id: row.id,
    documentType: row.document_type,
    documentTypeLabel: row.document_types?.label ?? row.document_type,
    requiresExpiry: row.document_types?.requires_expiry ?? false,
    status: row.status,
    currentVersion: row.current_version,
    fileName: row.file_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    expiresAt: row.expires_at,
    reviewerComment: row.reviewer_comment,
    reviewerName: row.reviewer?.full_name ?? null,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function loadDocument(documentId: string): Promise<DocumentRow> {
  const { data, error } = await supabaseAdmin.from('student_documents').select(DOCUMENT_COLUMNS).eq('id', documentId).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'document_not_found', 'Document introuvable.');
  return data as unknown as DocumentRow;
}

// ENF-02 : l'étudiant concerné, l'enseignant de sa classe ou l'admin.
async function assertDocumentAccess(auth: AuthContext, document: Pick<DocumentRow, 'student_id'>) {
  if (auth.role === 'student') {
    if (document.student_id !== auth.userId) throw new HttpError(404, 'document_not_found', 'Document introuvable.');
    return;
  }
  await assertCanFollowStudent(auth, document.student_id);
}

async function classTeacherIds(studentId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from('class_students')
    .select('classes!inner(teacher_id, is_active)')
    .eq('student_id', studentId)
    .eq('classes.is_active', true);
  if (error) throw error;
  return (data as unknown as { classes: { teacher_id: string | null } }[]).map((row) => row.classes.teacher_id).filter((id): id is string => Boolean(id));
}

// ─────────────────────────────────────────────────────────────
// Lecture : documents + checklist
// ─────────────────────────────────────────────────────────────

export async function getStudentDocumentsSpace(studentId: string) {
  const [documentsResult, historyResult, profileResult, requirements, documentTypes] = await Promise.all([
    supabaseAdmin.from('student_documents').select(DOCUMENT_COLUMNS).eq('student_id', studentId),
    supabaseAdmin
      .from('document_events')
      .select('id, document_id, action, version, comment, created_at, actor:profiles!document_events_actor_id_fkey(full_name), student_documents!inner(student_id)')
      .eq('student_documents.student_id', studentId)
      .order('created_at', { ascending: false })
      .limit(100),
    supabaseAdmin.from('student_profiles').select('visa_type, financing_source, has_guarantor, study_objective').eq('student_id', studentId).maybeSingle(),
    listRequirements(true),
    listDocumentTypes(),
  ]);
  if (documentsResult.error) throw documentsResult.error;
  if (historyResult.error) throw historyResult.error;
  if (profileResult.error) throw profileResult.error;

  const documents = (documentsResult.data as unknown as DocumentRow[]).map(toDocument);
  const snapshots = new Map<string, DocumentSnapshot>(
    documents.map((document) => [
      document.documentType,
      { id: document.id, status: document.status, expiresAt: document.expiresAt, currentVersion: document.currentVersion, reviewerComment: document.reviewerComment, updatedAt: document.updatedAt },
    ]),
  );
  const profile = profileResult.data as { visa_type: VisaType | null; financing_source: string | null; has_guarantor: boolean | null; study_objective: string | null } | null;
  // Projet d'études déclaré sans type de visa précisé : visa pour études par défaut.
  const visaType = profile?.visa_type ?? (profile?.study_objective ? 'etudes' : null);

  return {
    checklist: buildChecklist(requirements, { visaType, financingSource: profile?.financing_source ?? null, hasGuarantor: profile?.has_guarantor ?? null }, snapshots),
    documents,
    documentTypes,
    history: (historyResult.data as unknown as Record<string, unknown>[]).map((row) => ({
      id: row.id as string,
      documentId: row.document_id as string,
      action: row.action as string,
      version: row.version as number | null,
      comment: row.comment as string | null,
      actorName: (row.actor as { full_name: string } | null)?.full_name ?? null,
      createdAt: row.created_at as string,
    })),
  };
}

export async function getDocumentsSpaceForStaff(auth: AuthContext, studentId: string) {
  await assertCanFollowStudent(auth, studentId);
  return getStudentDocumentsSpace(studentId);
}

// ─────────────────────────────────────────────────────────────
// Dépôt (EF-44)
// ─────────────────────────────────────────────────────────────

export async function uploadDocument(studentId: string, documentType: string, file: Buffer, rawFileName: string | undefined) {
  if (file.length === 0) throw new HttpError(400, 'empty_file', 'Le fichier est vide.');
  if (file.length > MAX_DOCUMENT_BYTES) throw new HttpError(413, 'file_too_large', 'Fichier trop volumineux (10 Mo maximum).');
  const mimeType = detectDocumentMimeType(file);
  if (!mimeType) throw new HttpError(415, 'unsupported_file_type', 'Formats acceptés : PDF, JPEG, PNG ou WebP.');

  const { data: type, error: typeError } = await supabaseAdmin.from('document_types').select('code, label').eq('code', documentType).eq('is_active', true).maybeSingle();
  if (typeError) throw typeError;
  if (!type) throw new HttpError(404, 'document_type_not_found', 'Type de document inconnu.');

  const { data: existingData, error: existingError } = await supabaseAdmin
    .from('student_documents')
    .select('id, current_version')
    .eq('student_id', studentId)
    .eq('document_type', documentType)
    .maybeSingle();
  if (existingError) throw existingError;
  const existing = existingData as { id: string; current_version: number } | null;

  const fileName = sanitizeDocumentFileName(rawFileName, mimeType);
  // Chemin opaque : aucune donnée fournie par l'utilisateur.
  const storagePath = `${studentId}/${documentType}/${randomUUID()}.${DOCUMENT_MIME_EXTENSIONS[mimeType]}`;
  const { error: uploadError } = await supabaseAdmin.storage.from(DOCUMENT_BUCKET).upload(storagePath, file, { contentType: mimeType, upsert: false });
  if (uploadError) throw uploadError;

  try {
    const version = existing ? existing.current_version + 1 : 1;
    const fileColumns = { storage_path: storagePath, file_name: fileName, mime_type: mimeType, size_bytes: file.length };
    let documentId: string;

    if (existing) {
      // Nouvelle version : repasse en attente de vérification.
      const { data, error } = await supabaseAdmin
        .from('student_documents')
        .update({ ...fileColumns, current_version: version, status: 'submitted', reviewer_comment: null, reviewed_by: null, reviewed_at: null, expiry_notified_at: null })
        .eq('id', existing.id)
        .eq('current_version', existing.current_version)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new HttpError(409, 'document_modified', 'Le document a été modifié entre-temps. Réessayez.');
      documentId = existing.id;
    } else {
      const { data, error } = await supabaseAdmin
        .from('student_documents')
        .insert({ ...fileColumns, student_id: studentId, document_type: documentType })
        .select('id')
        .single();
      if (error?.code === '23505') throw new HttpError(409, 'document_modified', 'Le document a été modifié entre-temps. Réessayez.');
      if (error) throw error;
      documentId = data.id as string;
    }

    const [versionResult, eventResult] = await Promise.all([
      supabaseAdmin.from('student_document_versions').insert({ ...fileColumns, document_id: documentId, version, uploaded_by: studentId }),
      supabaseAdmin.from('document_events').insert({ document_id: documentId, actor_id: studentId, action: 'upload', version }),
    ]);
    if (versionResult.error) throw versionResult.error;
    if (eventResult.error) throw eventResult.error;

    await recordAudit({ actorId: studentId, action: 'document.upload', entityType: 'student_document', entityId: documentId, metadata: { documentType, version } });
    // Enseignants de la classe : notification in-app uniquement (pas d'email à chaque dépôt).
    await notifySafely(await classTeacherIds(studentId), {
      type: 'document_submitted',
      title: `Nouveau document à vérifier : ${type.label as string}`,
      link: `/suivi/etudiants/${studentId}`,
      dedupeKey: `document_submitted:${documentId}:${version}`,
    });

    return getStudentDocumentsSpace(studentId);
  } catch (err) {
    // Pas de fichier orphelin dans le stockage si l'enregistrement échoue.
    await supabaseAdmin.storage.from(DOCUMENT_BUCKET).remove([storagePath]);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────
// Téléchargement : URL signée courte, jamais d'URL publique
// ─────────────────────────────────────────────────────────────

export async function getDocumentDownloadUrl(auth: AuthContext, documentId: string, version?: number) {
  const document = await loadDocument(documentId);
  await assertDocumentAccess(auth, document);

  let path = document.storage_path;
  let fileName = document.file_name;
  if (version && version !== document.current_version) {
    const { data, error } = await supabaseAdmin.from('student_document_versions').select('storage_path, file_name').eq('document_id', documentId).eq('version', version).maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(404, 'version_not_found', 'Version introuvable.');
    path = data.storage_path as string;
    fileName = data.file_name as string;
  }

  const { data, error } = await supabaseAdmin.storage.from(DOCUMENT_BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS, { download: fileName });
  if (error) throw error;
  if (auth.role !== 'student') {
    await recordAudit({ actorId: auth.userId, action: 'document.download', entityType: 'student_document', entityId: documentId, metadata: { version: version ?? document.current_version } });
  }
  return { url: data.signedUrl, expiresInSeconds: SIGNED_URL_SECONDS, fileName };
}

// ─────────────────────────────────────────────────────────────
// Vérification (EF-45), expiration (EF-46), suppression
// ─────────────────────────────────────────────────────────────

export async function reviewDocument(
  auth: AuthContext,
  documentId: string,
  input: { action: 'validate' | 'request_correction'; version: number; comment?: string | undefined },
) {
  const document = await loadDocument(documentId);
  await assertCanFollowStudent(auth, document.student_id);
  if (input.action === 'request_correction' && !input.comment?.trim()) {
    throw new HttpError(400, 'comment_required', 'Expliquez à l’étudiant ce qui doit être corrigé.');
  }

  // Le relecteur statue sur la version qu'il a consultée, pas sur un dépôt arrivé entre-temps.
  const { data, error } = await supabaseAdmin
    .from('student_documents')
    .update({
      status: input.action === 'validate' ? 'validated' : 'needs_correction',
      reviewer_comment: input.comment?.trim() || null,
      reviewed_by: auth.userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', documentId)
    .eq('current_version', input.version)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(409, 'document_modified', 'Une nouvelle version a été déposée entre-temps. Rechargez la page.');

  const { error: eventError } = await supabaseAdmin
    .from('document_events')
    .insert({ document_id: documentId, actor_id: auth.userId, action: input.action, version: input.version, comment: input.comment?.trim() || null });
  if (eventError) throw eventError;
  await recordAudit({ actorId: auth.userId, action: `document.${input.action}`, entityType: 'student_document', entityId: documentId, metadata: { version: input.version } });

  const label = document.document_types?.label ?? 'Votre document';
  await notifySafely([document.student_id], {
    type: input.action === 'validate' ? 'document_validated' : 'document_needs_correction',
    title: input.action === 'validate' ? `${label} vérifié` : `${label} : correction demandée`,
    body: input.action === 'validate' ? 'Le centre a vérifié ce document pour votre suivi de préparation.' : 'Le centre vous demande de corriger ce document. Consultez le commentaire dans votre espace.',
    link: '/etudiant/documents',
    dedupeKey: `document_review:${documentId}:${input.version}:${input.action}`,
    email: true,
  });

  return getStudentDocumentsSpace(document.student_id);
}

export async function setDocumentExpiry(auth: AuthContext, documentId: string, expiresAt: string | null) {
  const document = await loadDocument(documentId);
  await assertDocumentAccess(auth, document);

  const { error } = await supabaseAdmin.from('student_documents').update({ expires_at: expiresAt, expiry_notified_at: null }).eq('id', documentId);
  if (error) throw error;
  const { error: eventError } = await supabaseAdmin
    .from('document_events')
    .insert({ document_id: documentId, actor_id: auth.userId, action: 'set_expiry', version: document.current_version, comment: expiresAt ? `Expiration : ${expiresAt}` : 'Expiration retirée' });
  if (eventError) throw eventError;
  return getStudentDocumentsSpace(document.student_id);
}

export async function deleteDocument(auth: AuthContext, documentId: string) {
  const document = await loadDocument(documentId);
  await assertDocumentAccess(auth, document);
  if (auth.role === 'student' && document.status === 'validated') {
    throw new HttpError(409, 'document_validated', 'Un document vérifié ne peut pas être supprimé : déposez plutôt une nouvelle version.');
  }

  const { data: versions, error } = await supabaseAdmin.from('student_document_versions').select('storage_path').eq('document_id', documentId);
  if (error) throw error;
  const paths = [...new Set([document.storage_path, ...(versions as { storage_path: string }[]).map((row) => row.storage_path)])];
  const { error: removeError } = await supabaseAdmin.storage.from(DOCUMENT_BUCKET).remove(paths);
  if (removeError) throw removeError;

  const { error: deleteError } = await supabaseAdmin.from('student_documents').delete().eq('id', documentId);
  if (deleteError) throw deleteError;
  await recordAudit({ actorId: auth.userId, action: 'document.delete', entityType: 'student_document', entityId: documentId, metadata: { documentType: document.document_type } });
}

export async function getDocumentsOverview(auth: AuthContext) {
  const { data, error } = await supabaseAdmin.rpc('documents_overview', { p_teacher_id: auth.role === 'admin' ? null : auth.userId });
  if (error) throw error;
  return data as Record<string, unknown>;
}
