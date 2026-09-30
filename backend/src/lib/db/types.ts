export type Row = Record<string, unknown>;

export type ColumnType = 'uuid' | 'text' | 'integer' | 'number' | 'boolean' | 'timestamp' | 'date' | 'json' | 'array';

export interface ColumnSchema {
  type: ColumnType;
  notNull?: boolean;
  // 'now' : horodatage courant, 'uuid' : identifiant aléatoire, sinon valeur littérale.
  default?: 'now' | 'uuid' | { value: unknown };
}

export interface UniqueConstraint {
  columns: string[];
  // Index unique partiel (ex. une seule simulation « in_progress » par étudiant).
  where?: (row: Row) => boolean;
}

export interface ForeignKey {
  name: string;
  columns: string[];
  table: string;
  references: string[];
  onDelete: 'cascade' | 'set null' | 'restrict' | 'no action';
}

export interface TableSchema {
  primaryKey: string[];
  columns: Record<string, ColumnSchema>;
  unique?: UniqueConstraint[];
  foreignKeys?: ForeignKey[];
}

// Mêmes codes que Postgres/PostgREST : le code métier les teste déjà (23505, 23503, 23514…).
export class DbError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details: string | null = null,
  ) {
    super(message);
    this.name = 'DbError';
  }
}

export interface DbResult<T = unknown> {
  data: T;
  error: DbError | null;
  count: number | null;
}
