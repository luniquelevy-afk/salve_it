// Filtres évalués avec la sémantique SQL : toute comparaison avec NULL est fausse,
// seuls « is null » / « not is null » testent l'absence de valeur.
import { splitTopLevel } from './select.js';
import { DbError, type Row } from './types.js';
import { coerce, columnSchema } from './values.js';

export type Operator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'is' | 'like' | 'ilike';

export type Filter =
  | { kind: 'cmp'; column: string; op: Operator; value: unknown }
  | { kind: 'not'; filter: Filter }
  | { kind: 'or'; filters: Filter[] }
  | { kind: 'and'; filters: Filter[] };

const OPERATORS = new Set<Operator>(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'is', 'like', 'ilike']);

export function asOperator(op: string): Operator {
  if (!OPERATORS.has(op as Operator)) throw new DbError('PGRST100', `Opérateur non pris en charge : ${op}`);
  return op as Operator;
}

// Valeur textuelle PostgREST : « (a,b) » pour in, « null/true/false » pour is.
export function parseRawValue(op: Operator, raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;
  if (op === 'in') {
    const inner = raw.trim().replace(/^\(/, '').replace(/\)$/, '');
    return inner === '' ? [] : splitTopLevel(inner).map((value) => value.replace(/^"(.*)"$/, '$1'));
  }
  if (op === 'is') return raw === 'null' ? null : raw === 'true' ? true : raw === 'false' ? false : raw;
  return raw;
}

// Syntaxe de .or() : « col.op.valeur, col.not.op.valeur, and(...), or(...) ».
export function parseLogicalFilter(expression: string): Filter[] {
  return splitTopLevel(expression).map((part): Filter => {
    const group = /^(and|or)\(([\s\S]*)\)$/.exec(part);
    if (group) {
      const filters = parseLogicalFilter(group[2] as string);
      return group[1] === 'and' ? { kind: 'and', filters } : { kind: 'or', filters };
    }
    const match = /^([a-z_][a-z0-9_.]*?)\.(not\.)?([a-z]+)\.([\s\S]*)$/i.exec(part);
    if (!match) throw new DbError('PGRST100', `Filtre invalide : « ${part} »`);
    const [, column, negated, opText, raw] = match as unknown as [string, string, string | undefined, string, string];
    const op = asOperator(opText);
    const filter: Filter = { kind: 'cmp', column, op, value: parseRawValue(op, raw) };
    return negated ? { kind: 'not', filter } : filter;
  });
}

function likeToRegExp(pattern: string, flags: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.');
  return new RegExp(`^${escaped}$`, flags);
}

function compare(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const left = String(a);
  const right = String(b);
  return left < right ? -1 : left > right ? 1 : 0;
}

// Normalise la valeur d'un filtre selon le type de la colonne visée.
export function coerceFilterValue(table: string, column: string, op: Operator, value: unknown): unknown {
  const schema = columnSchema(table, column);
  if (op === 'in') return (value as unknown[]).map((item) => coerce(schema, item));
  if (op === 'is' || op === 'like' || op === 'ilike') return value;
  return coerce(schema, value);
}

// Évalue une comparaison ; `value` est déjà normalisée.
function evaluateCmp(actual: unknown, op: Operator, value: unknown): boolean | null {
  if (op === 'is') return value === null ? actual === null : actual === value;
  if (actual === null || actual === undefined) return null;
  switch (op) {
    case 'eq':
      return value === null ? null : compare(actual, value) === 0;
    case 'neq':
      return value === null ? null : compare(actual, value) !== 0;
    case 'gt':
      return compare(actual, value) > 0;
    case 'gte':
      return compare(actual, value) >= 0;
    case 'lt':
      return compare(actual, value) < 0;
    case 'lte':
      return compare(actual, value) <= 0;
    case 'in':
      return (value as unknown[]).some((item) => item !== null && compare(actual, item) === 0);
    case 'like':
      return likeToRegExp(String(value), '').test(String(actual));
    case 'ilike':
      return likeToRegExp(String(value), 'i').test(String(actual));
  }
}

// Logique à trois valeurs (vrai / faux / inconnu) : NOT d'un inconnu reste inconnu, donc exclu.
function evaluate(row: Row, filter: Filter): boolean | null {
  switch (filter.kind) {
    case 'cmp':
      return evaluateCmp(row[filter.column], filter.op, filter.value);
    case 'not': {
      const result = evaluate(row, filter.filter);
      return result === null ? null : !result;
    }
    case 'or': {
      const results = filter.filters.map((inner) => evaluate(row, inner));
      if (results.includes(true)) return true;
      return results.includes(null) ? null : false;
    }
    case 'and': {
      const results = filter.filters.map((inner) => evaluate(row, inner));
      if (results.includes(false)) return false;
      return results.includes(null) ? null : true;
    }
  }
}

export function matches(row: Row, filters: Filter[]): boolean {
  return filters.every((filter) => evaluate(row, filter) === true);
}

// Normalise récursivement les valeurs des filtres portant sur les colonnes de `table`.
export function normalizeFilter(table: string, filter: Filter): Filter {
  switch (filter.kind) {
    case 'cmp':
      return { ...filter, value: coerceFilterValue(table, filter.column, filter.op, filter.value) };
    case 'not':
      return { kind: 'not', filter: normalizeFilter(table, filter.filter) };
    default:
      return { kind: filter.kind, filters: filter.filters.map((inner) => normalizeFilter(table, inner)) };
  }
}

// Ordre PostgREST : NULL en dernier en ascendant, en premier en descendant.
export function compareRows(a: Row, b: Row, orders: { column: string; ascending: boolean }[]): number {
  for (const { column, ascending } of orders) {
    const left = a[column] ?? null;
    const right = b[column] ?? null;
    if (left === right) continue;
    if (left === null) return ascending ? 1 : -1;
    if (right === null) return ascending ? -1 : 1;
    const result = compare(left, right);
    if (result !== 0) return ascending ? result : -result;
  }
  return 0;
}
