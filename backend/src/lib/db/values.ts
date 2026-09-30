import { randomUUID } from 'node:crypto';
import { TABLES } from './schema.js';
import { DbError, type ColumnSchema, type Row, type TableSchema } from './types.js';

export type TableName = keyof typeof TABLES;

export function tableSchema(table: string): TableSchema {
  const schema = (TABLES as Record<string, TableSchema>)[table];
  if (!schema) throw new DbError('42P01', `Collection inconnue : ${table}`);
  return schema;
}

export function columnSchema(table: string, column: string): ColumnSchema {
  const column_ = tableSchema(table).columns[column];
  if (!column_) throw new DbError('PGRST204', `Colonne inconnue : ${table}.${column}`);
  return column_;
}

// Horodatages stockés en ISO 8601 UTC (« …Z ») : l'ordre lexicographique suit l'ordre chronologique.
export function toTimestamp(value: unknown): string {
  const time = value instanceof Date ? value.getTime() : typeof value === 'string' || typeof value === 'number' ? new Date(value).getTime() : Number.NaN;
  if (Number.isNaN(time)) throw new DbError('22007', `Horodatage invalide : ${String(value)}`);
  return new Date(time).toISOString();
}

function toDate(value: unknown): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return toTimestamp(value).slice(0, 10);
}

// Valeur applicative → valeur comparable (filtres et contrôles), selon le type de colonne.
export function coerce(column: ColumnSchema, value: unknown): unknown {
  if (value === null || value === undefined) return null;
  switch (column.type) {
    case 'timestamp':
      return toTimestamp(value);
    case 'date':
      return toDate(value);
    case 'integer':
    case 'number':
      return typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value)) ? Number(value) : value;
    case 'boolean':
      return value === 'true' ? true : value === 'false' ? false : value;
    default:
      return value;
  }
}

export function defaultValue(column: ColumnSchema, now: string): unknown {
  if (column.default === undefined) return null;
  if (column.default === 'now') return column.type === 'date' ? now.slice(0, 10) : now;
  if (column.default === 'uuid') return randomUUID();
  // Copie : une valeur par défaut [] ou {} ne doit jamais être partagée entre lignes.
  return structuredClone(column.default.value);
}

// Ligne → document Firestore. Les colonnes JSON sont sérialisées : Firestore refuse les
// tableaux imbriqués, et leur contenu n'est jamais interrogé côté base.
export function encodeRow(table: string, row: Row): Row {
  const schema = tableSchema(table);
  const encoded: Row = {};
  for (const [name, value] of Object.entries(row)) {
    const column = schema.columns[name];
    if (!column) throw new DbError('PGRST204', `Colonne inconnue : ${table}.${name}`);
    const normalized = coerce(column, value);
    encoded[name] = column.type === 'json' && normalized !== null ? JSON.stringify(normalized) : normalized;
  }
  return encoded;
}

export function decodeDoc(table: string, data: Row): Row {
  const schema = tableSchema(table);
  const row: Row = {};
  for (const [name, column] of Object.entries(schema.columns)) {
    const value = data[name];
    if (value === undefined || value === null) row[name] = null;
    else row[name] = column.type === 'json' && typeof value === 'string' ? JSON.parse(value) : value;
  }
  return row;
}

// Identifiant de document = clé primaire (composée : valeurs jointes par « __ »).
export function docIdFor(table: string, row: Row): string {
  const { primaryKey } = tableSchema(table);
  const parts = primaryKey.map((column) => {
    const value = row[column];
    if (value === null || value === undefined) throw new DbError('23502', `Clé primaire manquante : ${table}.${column}`);
    const text = String(value);
    if (text.includes('/') || text.includes('__')) throw new DbError('22023', `Clé primaire invalide : ${table}.${column}`);
    return text;
  });
  return parts.join('__');
}
