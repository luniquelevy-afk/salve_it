// Scénarios d'entretien (§10.2, EF-54) — administrables sans redéploiement (ENF-10).
import { HttpError } from '../lib/http-error.js';
import { db } from '../lib/db/index.js';
import { recordAudit } from './audit.js';
import type { VisaType } from './embassy-prompts.js';

export interface Scenario {
  code: string;
  label: string;
  description: string;
  visaTypes: VisaType[];
  agentInstructions: string;
  focusThemes: string[];
  isActive: boolean;
  displayOrder: number;
}

const COLUMNS = 'code, label, description, visa_types, agent_instructions, focus_themes, is_active, display_order';

function toScenario(row: Record<string, unknown>): Scenario {
  return {
    code: row.code as string,
    label: row.label as string,
    description: row.description as string,
    visaTypes: row.visa_types as VisaType[],
    agentInstructions: row.agent_instructions as string,
    focusThemes: row.focus_themes as string[],
    isActive: row.is_active as boolean,
    displayOrder: row.display_order as number,
  };
}

export async function listScenarios(onlyActive: boolean): Promise<Scenario[]> {
  let query = db.from('embassy_scenarios').select(COLUMNS);
  if (onlyActive) query = query.eq('is_active', true);
  const { data, error } = await query.order('display_order');
  if (error) throw error;
  return (data as Record<string, unknown>[]).map(toScenario);
}

export async function getScenario(code: string): Promise<Scenario | null> {
  const { data, error } = await db.from('embassy_scenarios').select(COLUMNS).eq('code', code).maybeSingle();
  if (error) throw error;
  return data ? toScenario(data) : null;
}

export type ScenarioInput = Omit<Scenario, 'code'> & { code: string };

function toRow(input: ScenarioInput, actorId: string) {
  return {
    code: input.code,
    label: input.label,
    description: input.description,
    visa_types: input.visaTypes,
    agent_instructions: input.agentInstructions,
    focus_themes: input.focusThemes.map((theme) => theme.trim()).filter(Boolean),
    is_active: input.isActive,
    display_order: input.displayOrder,
    updated_by: actorId,
  };
}

export async function createScenario(actorId: string, input: ScenarioInput) {
  const { data, error } = await db.from('embassy_scenarios').insert(toRow(input, actorId)).select(COLUMNS).single();
  if (error?.code === '23505') throw new HttpError(409, 'scenario_code_taken', 'Ce code de scénario existe déjà.');
  if (error) throw error;
  await recordAudit({ actorId, action: 'embassy_scenario.create', entityType: 'embassy_scenario', metadata: { code: input.code } });
  return toScenario(data);
}

export async function updateScenario(actorId: string, code: string, input: ScenarioInput) {
  if (code === 'standard' && !input.isActive) throw new HttpError(400, 'scenario_required', 'Le scénario classique ne peut pas être désactivé.');
  const { data, error } = await db.from('embassy_scenarios').update(toRow({ ...input, code }, actorId)).eq('code', code).select(COLUMNS).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'scenario_not_found', 'Scénario introuvable.');
  await recordAudit({ actorId, action: 'embassy_scenario.update', entityType: 'embassy_scenario', metadata: { code } });
  return toScenario(data);
}
