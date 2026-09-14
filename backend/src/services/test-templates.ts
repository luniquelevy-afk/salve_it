// Modèles de test configurables (§7, EF-42) — barème et sections versionnés (§19.11).
import { HttpError } from '../lib/http-error.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { recordAudit } from './audit.js';

export interface TemplateInput {
  code: string;
  name: string;
  description?: string | null | undefined;
  language: string;
  totalDurationSeconds: number;
  scoringRules: { correct: number; wrong: number; blank: number };
  isActive: boolean;
  sections: { name: string; category: string; questionCount: number }[];
}

interface TemplateRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  language: string;
  total_duration_seconds: number;
  scoring_rules: TemplateInput['scoringRules'];
  is_active: boolean;
  version: number;
  updated_at: string;
  test_sections: { id: string; name: string; category: string; question_count: number; order_index: number }[];
}

const COLUMNS =
  'id, code, name, description, language, total_duration_seconds, scoring_rules, is_active, version, updated_at, test_sections(id, name, category, question_count, order_index)';

export async function listTemplatesForAdmin() {
  const [templatesResult, questionsResult, usageResult] = await Promise.all([
    supabaseAdmin.from('test_templates').select(COLUMNS).order('name'),
    supabaseAdmin.from('questions').select('category').eq('validation_status', 'active'),
    supabaseAdmin.from('simulations').select('test_template_id').not('test_template_id', 'is', null),
  ]);
  if (templatesResult.error) throw templatesResult.error;
  if (questionsResult.error) throw questionsResult.error;
  if (usageResult.error) throw usageResult.error;

  const activeByCategory = new Map<string, number>();
  for (const row of questionsResult.data as { category: string }[]) activeByCategory.set(row.category, (activeByCategory.get(row.category) ?? 0) + 1);
  const usage = new Map<string, number>();
  for (const row of usageResult.data as { test_template_id: string }[]) usage.set(row.test_template_id, (usage.get(row.test_template_id) ?? 0) + 1);

  return (templatesResult.data as unknown as TemplateRow[]).map((template) => {
    const sections = [...template.test_sections].sort((a, b) => a.order_index - b.order_index);
    // Besoin total par catégorie : plusieurs sections peuvent partager une catégorie.
    const needed = new Map<string, number>();
    for (const section of sections) needed.set(section.category, (needed.get(section.category) ?? 0) + section.question_count);
    return {
      id: template.id,
      code: template.code,
      name: template.name,
      description: template.description,
      language: template.language,
      totalDurationSeconds: template.total_duration_seconds,
      scoringRules: template.scoring_rules,
      isActive: template.is_active,
      version: template.version,
      updatedAt: template.updated_at,
      simulationCount: usage.get(template.id) ?? 0,
      sections: sections.map((section) => ({
        id: section.id,
        name: section.name,
        category: section.category,
        questionCount: section.question_count,
        activeQuestions: activeByCategory.get(section.category) ?? 0,
      })),
      missingQuestions: [...needed.entries()]
        .map(([category, count]) => ({ category, missing: Math.max(0, count - (activeByCategory.get(category) ?? 0)) }))
        .filter((entry) => entry.missing > 0),
    };
  });
}

function templateRow(input: TemplateInput) {
  return {
    code: input.code,
    name: input.name,
    description: input.description || null,
    language: input.language,
    total_duration_seconds: input.totalDurationSeconds,
    scoring_rules: input.scoringRules,
    is_active: input.isActive,
  };
}

async function replaceSections(templateId: string, sections: TemplateInput['sections']) {
  const { error: deleteError } = await supabaseAdmin.from('test_sections').delete().eq('template_id', templateId);
  if (deleteError) throw deleteError;
  const { error } = await supabaseAdmin.from('test_sections').insert(
    sections.map((section, index) => ({
      template_id: templateId,
      name: section.name,
      category: section.category.trim().toLowerCase(),
      question_count: section.questionCount,
      order_index: index,
    })),
  );
  if (error) throw error;
}

export async function createTemplate(actorId: string, input: TemplateInput) {
  const { data, error } = await supabaseAdmin
    .from('test_templates')
    .insert({ ...templateRow(input), created_by: actorId })
    .select('id')
    .single();
  if (error?.code === '23505') throw new HttpError(409, 'template_code_taken', 'Ce code de modèle existe déjà.');
  if (error) throw error;
  try {
    await replaceSections(data.id as string, input.sections);
  } catch (err) {
    await supabaseAdmin.from('test_templates').delete().eq('id', data.id);
    throw err;
  }
  await recordAudit({ actorId, action: 'test_template.create', entityType: 'test_template', entityId: data.id });
  return { id: data.id as string };
}

// Toute modification crée une nouvelle version ; les simulations passées gardent la leur.
export async function updateTemplate(actorId: string, id: string, input: TemplateInput) {
  const { data: current, error: loadError } = await supabaseAdmin.from('test_templates').select('version').eq('id', id).maybeSingle();
  if (loadError) throw loadError;
  if (!current) throw new HttpError(404, 'template_not_found', 'Modèle de test introuvable.');

  const nextVersion = (current.version as number) + 1;
  const { data, error } = await supabaseAdmin
    .from('test_templates')
    .update({ ...templateRow(input), version: nextVersion })
    .eq('id', id)
    .eq('version', current.version)
    .select('id')
    .maybeSingle();
  if (error?.code === '23505') throw new HttpError(409, 'template_code_taken', 'Ce code de modèle existe déjà.');
  if (error) throw error;
  if (!data) throw new HttpError(409, 'template_modified', 'Le modèle a été modifié entre-temps. Rechargez la page.');

  await replaceSections(id, input.sections);
  await recordAudit({ actorId, action: 'test_template.update', entityType: 'test_template', entityId: id, metadata: { version: nextVersion } });
  return { id, version: nextVersion };
}
