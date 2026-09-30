/* eslint-disable @typescript-eslint/no-explicit-any -- résultats non typés, comme l'ancien client Supabase */
// Couche d'accès Firestore exposant l'API chaînée héritée de supabase-js (from/select/eq/insert…),
// pour conserver le code métier et ses garanties relationnelles :
// - lecture : filtres d'égalité exécutés par Firestore (sans index composite), plages, tri,
//   pagination et jointures évalués en mémoire — adapté au volume d'un centre de formation ;
// - écriture : transaction appliquant valeurs par défaut, NOT NULL, CHECK, unicités (y compris
//   partielles), clés étrangères, cascades « on delete » et déclencheurs du schéma SQL d'origine.
import { createHash } from 'node:crypto';
import type { DocumentReference, Firestore, Query, Transaction } from 'firebase-admin/firestore';
import { beforeUpdate, CHECKS, DELETE_TRIGGERS } from './constraints.js';
import { asOperator, compareRows, matches, normalizeFilter, parseLogicalFilter, parseRawValue, type Filter, type Operator } from './filters.js';
import { TABLES } from './schema.js';
import { parseSelect, type SelectNode } from './select.js';
import { DbError, type DbResult, type ForeignKey, type Row, type TableSchema } from './types.js';
import { coerce, columnSchema, decodeDoc, defaultValue, docIdFor, encodeRow, tableSchema } from './values.js';

const IN_LIMIT = 30; // disjonctions maximales d'une clause « in » Firestore
const GET_ALL_CHUNK = 300;
const SCALAR_TYPES = new Set(['uuid', 'text', 'integer', 'number', 'boolean', 'timestamp', 'date']);

// ─────────────────────────────────────────────────────────────
// Lecteurs : hors transaction, ou dans une transaction (lectures verrouillées)
// ─────────────────────────────────────────────────────────────
interface Reader {
  query(query: Query): Promise<{ id: string; data: Row }[]>;
  refs(refs: DocumentReference[]): Promise<({ id: string; data: Row } | null)[]>;
}

function directReader(store: Firestore): Reader {
  return {
    async query(query) {
      const snapshot = await query.get();
      return snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
    },
    async refs(refs) {
      const out: ({ id: string; data: Row } | null)[] = [];
      for (let index = 0; index < refs.length; index += GET_ALL_CHUNK) {
        const chunk = refs.slice(index, index + GET_ALL_CHUNK);
        if (chunk.length === 0) continue;
        const docs = await store.getAll(...chunk);
        out.push(...docs.map((doc) => (doc.exists ? { id: doc.id, data: doc.data() as Row } : null)));
      }
      return out;
    },
  };
}

function transactionReader(tx: Transaction): Reader {
  return {
    async query(query) {
      const snapshot = await tx.get(query);
      return snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
    },
    async refs(refs) {
      if (refs.length === 0) return [];
      const docs = await tx.getAll(...refs);
      return docs.map((doc) => (doc.exists ? { id: doc.id, data: doc.data() as Row } : null));
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Relations (jointures « table(colonnes) » de la sélection)
// ─────────────────────────────────────────────────────────────
type Relation =
  | { kind: 'one'; table: string; fk: ForeignKey } // la ligne courante référence la table jointe
  | { kind: 'many'; table: string; fk: ForeignKey }; // la table jointe référence la ligne courante

const ALL_TABLES = TABLES as Record<string, TableSchema>;

function pickForeignKey(candidates: ForeignKey[], hint: string | null, description: string): ForeignKey | null {
  const filtered = hint ? candidates.filter((fk) => fk.name === hint || fk.columns.join(',') === hint) : candidates;
  if (filtered.length > 1) throw new DbError('PGRST201', `Relation ambiguë : ${description} (précisez-la avec !nom_de_contrainte)`);
  return filtered[0] ?? null;
}

function resolveRelation(table: string, relation: string, hint: string | null): Relation {
  tableSchema(relation);
  const outgoing = pickForeignKey((tableSchema(table).foreignKeys ?? []).filter((fk) => fk.table === relation && fk.columns.length === 1), hint, `${table} → ${relation}`);
  if (outgoing) return { kind: 'one', table: relation, fk: outgoing };
  const incoming = pickForeignKey((tableSchema(relation).foreignKeys ?? []).filter((fk) => fk.table === table && fk.columns.length === 1), hint, `${relation} → ${table}`);
  if (incoming) return { kind: 'many', table: relation, fk: incoming };
  throw new DbError('PGRST200', `Aucune relation entre ${table} et ${relation}`);
}

// ─────────────────────────────────────────────────────────────
// Lecture
// ─────────────────────────────────────────────────────────────
function isOwnColumnFilter(filter: Filter): boolean {
  if (filter.kind === 'cmp') return !filter.column.includes('.');
  if (filter.kind === 'not') return isOwnColumnFilter(filter.filter);
  return filter.filters.every(isOwnColumnFilter);
}

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) out.push(items.slice(index, index + size));
  return out;
}

function toRows(table: string, docs: ({ id: string; data: Row } | null)[]): Row[] {
  return docs.filter((doc): doc is { id: string; data: Row } => doc !== null).map((doc) => decodeDoc(table, doc.data));
}

// Charge les lignes candidates de `table` : clé primaire → lecture directe ; sinon requête
// Firestore restreinte aux égalités (et à une clause « in »), le reste étant filtré en mémoire.
async function fetchCandidates(store: Firestore, reader: Reader, table: string, filters: Filter[]): Promise<Row[]> {
  const schema = tableSchema(table);
  const comparisons = filters.filter((filter): filter is Extract<Filter, { kind: 'cmp' }> => filter.kind === 'cmp');
  const collection = store.collection(table);

  if (comparisons.some((filter) => filter.op === 'in' && (filter.value as unknown[]).length === 0)) return [];

  const pkValues: Row = {};
  for (const column of schema.primaryKey) {
    const filter = comparisons.find((candidate) => candidate.column === column && candidate.op === 'eq' && candidate.value !== null);
    if (filter) pkValues[column] = filter.value;
  }
  if (Object.keys(pkValues).length === schema.primaryKey.length) {
    return toRows(table, await reader.refs([collection.doc(docIdFor(table, pkValues))]));
  }

  const [singlePk] = schema.primaryKey;
  if (schema.primaryKey.length === 1 && singlePk) {
    const pkIn = comparisons.find((filter) => filter.column === singlePk && filter.op === 'in');
    if (pkIn) {
      const ids = [...new Set((pkIn.value as unknown[]).filter((value) => value !== null).map((value) => docIdFor(table, { [singlePk]: value })))];
      return toRows(table, await reader.refs(ids.map((id) => collection.doc(id))));
    }
  }

  const scalar = (filter: Extract<Filter, { kind: 'cmp' }>) => SCALAR_TYPES.has(schema.columns[filter.column]?.type ?? 'json');
  const equalities = comparisons.filter((filter) => scalar(filter) && ((filter.op === 'eq' && filter.value !== null) || (filter.op === 'is' && filter.value === null)));
  const inFilter = comparisons.find((filter) => scalar(filter) && filter.op === 'in' && !(filter.value as unknown[]).includes(null));

  let query: Query = collection;
  for (const filter of equalities) query = query.where(filter.column, '==', filter.value);

  // Sans égalité, une plage sur une seule colonne s'appuie sur l'index simple automatique.
  if (equalities.length === 0 && !inFilter) {
    const range = comparisons.find((filter) => scalar(filter) && RANGE_OPERATORS[filter.op] && filter.value !== null);
    if (range) {
      for (const filter of comparisons) {
        const operator = RANGE_OPERATORS[filter.op];
        if (filter.column === range.column && operator && filter.value !== null) query = query.where(filter.column, operator, filter.value);
      }
    }
  }

  if (!inFilter) return toRows(table, await reader.query(query));
  // Clause « in » découpée en requêtes de 30 valeurs plutôt qu'un parcours complet.
  const rows: Row[] = [];
  for (const chunk of chunks([...new Set(inFilter.value as unknown[])], IN_LIMIT)) {
    rows.push(...toRows(table, await reader.query(query.where(inFilter.column, 'in', chunk))));
  }
  return rows;
}

const RANGE_OPERATORS: Partial<Record<Operator, '<' | '<=' | '>' | '>='>> = { lt: '<', lte: '<=', gt: '>', gte: '>=' };

interface EmbedValues {
  values: Map<Row, Map<string, unknown>>;
}

function stripPrefix(filters: Filter[], key: string): Filter[] {
  const prefix = `${key}.`;
  return filters
    .filter((filter): filter is Extract<Filter, { kind: 'cmp' }> => filter.kind === 'cmp' && filter.column.startsWith(prefix))
    .map((filter) => ({ ...filter, column: filter.column.slice(prefix.length) }));
}

// Résout les jointures de `nodes` pour `rows` et retire les lignes exclues par une jointure !inner.
async function resolveEmbeds(store: Firestore, reader: Reader, table: string, rows: Row[], nodes: SelectNode[], embeddedFilters: Filter[], state: EmbedValues): Promise<Row[]> {
  let kept = rows;
  for (const node of nodes) {
    if (node.kind !== 'embed') continue;
    const relation = resolveRelation(table, node.relation, node.hint);
    const childFilters = stripPrefix(embeddedFilters, node.key);
    const ownFilters = childFilters.filter((filter) => isOwnColumnFilter(filter)).map((filter) => normalizeFilter(relation.table, filter));
    const deeperFilters = childFilters.filter((filter) => !isOwnColumnFilter(filter));
    const [fkColumn] = relation.fk.columns as [string];
    const [refColumn] = relation.fk.references as [string];

    if (relation.kind === 'one') {
      const keys = [...new Set(kept.map((row) => row[fkColumn]).filter((value) => value !== null && value !== undefined))];
      const refs = keys.map((value) => store.collection(relation.table).doc(docIdFor(relation.table, { [refColumn]: value })));
      let children = toRows(relation.table, await reader.refs(refs)).filter((child) => matches(child, ownFilters));
      children = await resolveEmbeds(store, reader, relation.table, children, node.children, deeperFilters, state);
      const byKey = new Map(children.map((child) => [child[refColumn], child]));
      for (const row of kept) setEmbed(state, row, node.key, byKey.get(row[fkColumn]) ?? null);
      if (node.inner) kept = kept.filter((row) => state.values.get(row)?.get(node.key) !== null);
    } else {
      const keys = [...new Set(kept.map((row) => row[refColumn]).filter((value) => value !== null && value !== undefined))];
      let children: Row[] = [];
      for (const chunk of chunks(keys, IN_LIMIT)) {
        children.push(...toRows(relation.table, await reader.query(store.collection(relation.table).where(fkColumn, 'in', chunk))));
      }
      children = children.filter((child) => matches(child, ownFilters));
      children = await resolveEmbeds(store, reader, relation.table, children, node.children, deeperFilters, state);
      const grouped = new Map<unknown, Row[]>();
      for (const child of children) grouped.set(child[fkColumn], [...(grouped.get(child[fkColumn]) ?? []), child]);
      for (const row of kept) setEmbed(state, row, node.key, grouped.get(row[refColumn]) ?? []);
      if (node.inner) kept = kept.filter((row) => ((state.values.get(row)?.get(node.key) as Row[] | undefined) ?? []).length > 0);
    }
  }
  return kept;
}

function setEmbed(state: EmbedValues, row: Row, key: string, value: unknown) {
  const values = state.values.get(row) ?? new Map<string, unknown>();
  values.set(key, value);
  state.values.set(row, values);
}

function readPath(value: unknown, path: { key: string; asText: boolean }[]): unknown {
  let current = value;
  for (const step of path) {
    current = current !== null && typeof current === 'object' ? ((current as Row)[step.key] ?? null) : null;
    if (step.asText && current !== null) current = typeof current === 'object' ? JSON.stringify(current) : String(current);
  }
  return current;
}

function project(table: string, row: Row, nodes: SelectNode[], state: EmbedValues): Row {
  const out: Row = {};
  for (const node of nodes) {
    if (node.kind === 'star') {
      for (const column of Object.keys(tableSchema(table).columns)) out[column] = row[column] ?? null;
    } else if (node.kind === 'column') {
      columnSchema(table, node.name);
      out[node.key] = readPath(row[node.name] ?? null, node.path);
    } else if (node.kind === 'embed') {
      const relation = resolveRelation(table, node.relation, node.hint);
      const value = state.values.get(row)?.get(node.key) ?? (relation.kind === 'one' ? null : []);
      if (relation.kind === 'one') {
        out[node.key] = value === null ? null : project(relation.table, value as Row, node.children, state);
      } else if (node.children.length === 1 && node.children[0]?.kind === 'count') {
        out[node.key] = [{ count: (value as Row[]).length }];
      } else {
        out[node.key] = (value as Row[]).map((child) => project(relation.table, child, node.children, state));
      }
    } else {
      throw new DbError('PGRST100', 'count n’est autorisé que dans une jointure');
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────
// Écriture : contrôles d'intégrité
// ─────────────────────────────────────────────────────────────
function validateRow(table: string, row: Row): void {
  for (const [name, column] of Object.entries(tableSchema(table).columns)) {
    if (column.notNull && (row[name] === null || row[name] === undefined)) {
      throw new DbError('23502', `La colonne ${table}.${name} est obligatoire`);
    }
  }
  for (const [name, predicate] of CHECKS[table] ?? []) {
    if (!predicate(row)) throw new DbError('23514', `Contrainte ${name} violée sur ${table}`);
  }
}

// Ligne complète à insérer : valeurs fournies (normalisées) + valeurs par défaut.
function completeRow(table: string, input: Row, now: string): Row {
  const schema = tableSchema(table);
  const row: Row = {};
  for (const key of Object.keys(input)) columnSchema(table, key);
  for (const [name, column] of Object.entries(schema.columns)) {
    row[name] = input[name] === undefined ? defaultValue(column, now) : coerce(column, input[name]);
  }
  return row;
}

function applyPatch(table: string, previous: Row, patch: Row): Row {
  const next = { ...previous };
  for (const [name, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    next[name] = coerce(columnSchema(table, name), value);
  }
  return next;
}

interface WriteOp {
  kind: 'create' | 'update';
  table: string;
  row: Row;
  previous?: Row;
  previousId?: string;
}

// Clés étrangères et unicités de l'ensemble des écritures, lues dans la transaction.
async function checkIntegrity(store: Firestore, reader: Reader, ops: WriteOp[]): Promise<void> {
  for (const op of ops) {
    const schema = tableSchema(op.table);
    for (const fk of schema.foreignKeys ?? []) {
      const values = fk.columns.map((column) => op.row[column]);
      if (values.some((value) => value === null || value === undefined)) continue;
      const referenced = Object.fromEntries(fk.references.map((column, index) => [column, values[index]]));
      // Auto-référence insérée dans la même instruction.
      if (ops.some((other) => other.table === fk.table && fk.references.every((column) => other.row[column] === referenced[column]))) continue;
      const [doc] = await reader.refs([store.collection(fk.table).doc(docIdFor(fk.table, referenced))]);
      if (!doc) throw new DbError('23503', `Clé étrangère ${fk.name} violée : ${fk.table} introuvable`);
    }
  }

  const claimed = new Map<string, string>();
  for (const [index, op] of ops.entries()) {
    const id = docIdFor(op.table, op.row);
    const sameStatement = ops.filter((other, otherIndex) => otherIndex !== index && other.table === op.table);

    if (op.kind === 'create') {
      if (sameStatement.some((other) => docIdFor(other.table, other.row) === id)) throw new DbError('23505', `Clé primaire en double sur ${op.table}`);
      const [existing] = await reader.refs([store.collection(op.table).doc(id)]);
      if (existing) throw new DbError('23505', `Clé primaire en double sur ${op.table}`);
    } else if (op.previousId !== id) {
      throw new DbError('0A000', `Modification de clé primaire non prise en charge (${op.table})`);
    }

    const previousKeys = op.previous ? uniqueKeys(op.table, op.previous) : [];
    for (const { key, columns } of uniqueKeys(op.table, op.row)) {
      const violation = () => new DbError('23505', `Unicité (${columns.join(', ')}) violée sur ${op.table}`);
      if (claimed.has(key) && claimed.get(key) !== id) throw violation();
      claimed.set(key, id);
      if (previousKeys.some((previous) => previous.key === key)) continue;
      const [owner] = await reader.refs([store.collection(UNIQUE_KEYS).doc(key)]);
      if (owner && owner.data.id !== id) throw violation();
    }
  }
}

// Unicités matérialisées par un document-clé `_unique/{empreinte}` : lecture ponctuelle dans la
// transaction (verrou limité à la clé), au lieu d'une requête qui verrouillerait toute une plage.
const UNIQUE_KEYS = '_unique';

function uniqueKey(table: string, columns: string[], values: unknown[]): string {
  return createHash('sha256').update(JSON.stringify([table, columns, values])).digest('hex');
}

function uniqueKeys(table: string, row: Row): { key: string; columns: string[] }[] {
  return (tableSchema(table).unique ?? []).flatMap((constraint) => {
    const values = constraint.columns.map((column) => row[column]);
    // NULL ne crée pas de conflit ; index partiel : seulement les lignes concernées.
    if (values.some((value) => value === null || value === undefined)) return [];
    if (constraint.where && !constraint.where(row)) return [];
    return [{ key: uniqueKey(table, constraint.columns, values), columns: constraint.columns }];
  });
}

// Pose les nouvelles clés d'une ligne et retire celles qu'elle n'occupe plus.
function writeUniqueKeys(store: Firestore, tx: Transaction, table: string, previous: Row | null, next: Row | null) {
  const before = previous ? uniqueKeys(table, previous).map((entry) => entry.key) : [];
  const after = next ? uniqueKeys(table, next).map((entry) => entry.key) : [];
  const id = docIdFor(table, (next ?? previous) as Row);
  for (const key of before.filter((key) => !after.includes(key))) tx.delete(store.collection(UNIQUE_KEYS).doc(key));
  for (const key of after.filter((key) => !before.includes(key))) tx.set(store.collection(UNIQUE_KEYS).doc(key), { table, id });
}

function referencingKeys(table: string): { table: string; fk: ForeignKey }[] {
  return Object.entries(ALL_TABLES).flatMap(([name, schema]) => (schema.foreignKeys ?? []).filter((fk) => fk.table === table).map((fk) => ({ table: name, fk })));
}

interface DeletionPlan {
  deletes: Map<string, { table: string; id: string; row: Row }>;
  nullify: Map<string, { table: string; id: string; row: Row; previous: Row }>;
  restricted: { table: string; id: string; fk: ForeignKey }[];
}

// Propage une suppression selon les clés étrangères (cascade, set null, restrict) et déclencheurs.
async function planDeletion(store: Firestore, reader: Reader, table: string, rows: Row[], plan: DeletionPlan): Promise<void> {
  const fresh = rows.filter((row) => {
    const key = `${table}/${docIdFor(table, row)}`;
    if (plan.deletes.has(key)) return false;
    plan.deletes.set(key, { table, id: docIdFor(table, row), row });
    return true;
  });
  if (fresh.length === 0) return;

  for (const { table: child, fk } of referencingKeys(table)) {
    const children: { id: string; row: Row }[] = [];
    for (const row of fresh) {
      let query: Query = store.collection(child);
      for (const [index, column] of fk.columns.entries()) query = query.where(column, '==', row[fk.references[index] as string]);
      children.push(...(await reader.query(query)).map((doc) => ({ id: doc.id, row: decodeDoc(child, doc.data) })));
    }
    if (children.length === 0) continue;
    if (fk.onDelete === 'cascade') {
      await planDeletion(store, reader, child, children.map((entry) => entry.row), plan);
    } else if (fk.onDelete === 'set null') {
      for (const entry of children) {
        const key = `${child}/${entry.id}`;
        const current = plan.nullify.get(key)?.row ?? entry.row;
        plan.nullify.set(key, { table: child, id: entry.id, previous: entry.row, row: { ...current, ...Object.fromEntries(fk.columns.map((column) => [column, null])) } });
      }
    } else {
      plan.restricted.push(...children.map((entry) => ({ table: child, id: entry.id, fk })));
    }
  }

  for (const trigger of DELETE_TRIGGERS[table] ?? []) {
    for (const row of fresh) {
      let query: Query = store.collection(trigger.table);
      for (const [column, value] of Object.entries(trigger.match(row))) query = query.where(column, '==', value);
      await planDeletion(store, reader, trigger.table, toRows(trigger.table, await reader.query(query)), plan);
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Constructeur de requêtes
// ─────────────────────────────────────────────────────────────
type Operation = 'select' | 'insert' | 'update' | 'upsert' | 'delete';

export class QueryBuilder implements PromiseLike<DbResult<any>> {
  private operation: Operation = 'select';
  private selectClause: string | null = null;
  private returning = false;
  private countRequested = false;
  private head = false;
  private payload: Row[] = [];
  private patch: Row = {};
  private onConflict: string[] | null = null;
  private ignoreDuplicates = false;
  private readonly filters: Filter[] = [];
  private readonly orders: { column: string; ascending: boolean }[] = [];
  private rangeFrom = 0;
  private rangeTo: number | null = null;
  private cardinality: 'many' | 'single' | 'maybeSingle' = 'many';

  constructor(
    private readonly store: Firestore,
    private readonly table: string,
  ) {}

  select(columns = '*', options: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean } = {}): this {
    if (this.operation === 'select') {
      this.countRequested = Boolean(options.count);
      this.head = Boolean(options.head);
    } else {
      this.returning = true;
    }
    this.selectClause = columns;
    return this;
  }

  insert(values: Row | Row[], options: { count?: 'exact' } = {}): this {
    this.operation = 'insert';
    this.payload = Array.isArray(values) ? values : [values];
    this.countRequested = Boolean(options.count);
    return this;
  }

  upsert(values: Row | Row[], options: { onConflict?: string; ignoreDuplicates?: boolean; count?: 'exact' } = {}): this {
    this.operation = 'upsert';
    this.payload = Array.isArray(values) ? values : [values];
    this.onConflict = options.onConflict ? options.onConflict.split(',').map((column) => column.trim()) : null;
    this.ignoreDuplicates = Boolean(options.ignoreDuplicates);
    this.countRequested = Boolean(options.count);
    return this;
  }

  update(values: Row, options: { count?: 'exact' } = {}): this {
    this.operation = 'update';
    this.patch = values;
    this.countRequested = Boolean(options.count);
    return this;
  }

  delete(options: { count?: 'exact' } = {}): this {
    this.operation = 'delete';
    this.countRequested = Boolean(options.count);
    return this;
  }

  private cmp(column: string, op: Operator, value: unknown): this {
    this.filters.push({ kind: 'cmp', column, op, value });
    return this;
  }

  eq(column: string, value: unknown): this {
    return this.cmp(column, 'eq', value);
  }
  neq(column: string, value: unknown): this {
    return this.cmp(column, 'neq', value);
  }
  gt(column: string, value: unknown): this {
    return this.cmp(column, 'gt', value);
  }
  gte(column: string, value: unknown): this {
    return this.cmp(column, 'gte', value);
  }
  lt(column: string, value: unknown): this {
    return this.cmp(column, 'lt', value);
  }
  lte(column: string, value: unknown): this {
    return this.cmp(column, 'lte', value);
  }
  like(column: string, pattern: string): this {
    return this.cmp(column, 'like', pattern);
  }
  ilike(column: string, pattern: string): this {
    return this.cmp(column, 'ilike', pattern);
  }
  in(column: string, values: readonly unknown[]): this {
    return this.cmp(column, 'in', [...values]);
  }
  is(column: string, value: null | boolean): this {
    return this.cmp(column, 'is', value);
  }
  match(query: Row): this {
    for (const [column, value] of Object.entries(query)) this.eq(column, value);
    return this;
  }
  filter(column: string, op: string, value: unknown): this {
    const operator = asOperator(op);
    return this.cmp(column, operator, parseRawValue(operator, value));
  }
  not(column: string, op: string, value: unknown): this {
    const operator = asOperator(op);
    this.filters.push({ kind: 'not', filter: { kind: 'cmp', column, op: operator, value: parseRawValue(operator, value) } });
    return this;
  }
  or(expression: string): this {
    this.filters.push({ kind: 'or', filters: parseLogicalFilter(expression) });
    return this;
  }

  order(column: string, options: { ascending?: boolean } = {}): this {
    this.orders.push({ column, ascending: options.ascending ?? true });
    return this;
  }
  limit(count: number): this {
    this.rangeTo = this.rangeFrom + count - 1;
    return this;
  }
  range(from: number, to: number): this {
    this.rangeFrom = from;
    this.rangeTo = to;
    return this;
  }
  single(): this {
    this.cardinality = 'single';
    return this;
  }
  maybeSingle(): this {
    this.cardinality = 'maybeSingle';
    return this;
  }

  then<TResult1 = DbResult<any>, TResult2 = never>(
    onfulfilled?: ((value: DbResult<any>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute(): Promise<DbResult<any>> {
    try {
      tableSchema(this.table);
      const { rows, count } = this.operation === 'select' ? await this.runSelect() : await this.runMutation();
      return this.shape(rows, count);
    } catch (error) {
      if (error instanceof DbError) return { data: null, error, count: null };
      const message = error instanceof Error ? error.message : String(error);
      return { data: null, error: new DbError('FIRESTORE', message), count: null };
    }
  }

  private shape(rows: Row[] | null, count: number | null): DbResult<any> {
    const counted = this.countRequested ? count : null;
    if (rows === null || this.head) return { data: null, error: null, count: counted };
    if (this.cardinality === 'many') return { data: rows, error: null, count: counted };
    if (rows.length > 1 || (rows.length === 0 && this.cardinality === 'single')) {
      return { data: null, error: new DbError('PGRST116', `Une ligne attendue, ${rows.length} obtenue(s)`), count: counted };
    }
    return { data: rows[0] ?? null, error: null, count: counted };
  }

  private splitFilters(): { own: Filter[]; embedded: Filter[] } {
    const own = this.filters.filter(isOwnColumnFilter).map((filter) => normalizeFilter(this.table, filter));
    const embedded = this.filters.filter((filter) => !isOwnColumnFilter(filter));
    if (embedded.some((filter) => filter.kind !== 'cmp')) throw new DbError('PGRST100', 'Filtre composé sur une table jointe non pris en charge');
    return { own, embedded };
  }

  private async runSelect(): Promise<{ rows: Row[]; count: number }> {
    const { own, embedded } = this.splitFilters();
    const nodes = parseSelect(this.selectClause ?? '*');
    const reader = directReader(this.store);
    let rows = (await fetchCandidates(this.store, reader, this.table, own)).filter((row) => matches(row, own));
    const state: EmbedValues = { values: new Map() };
    rows = await resolveEmbeds(this.store, reader, this.table, rows, nodes, embedded, state);
    if (this.orders.length > 0) rows.sort((a, b) => compareRows(a, b, this.orders));
    const count = rows.length;
    rows = rows.slice(this.rangeFrom, this.rangeTo === null ? undefined : this.rangeTo + 1);
    return { rows: this.head ? [] : rows.map((row) => project(this.table, row, nodes, state)), count };
  }

  // Lignes renvoyées après écriture (.select() chaîné à insert/update/upsert/delete).
  private async projectReturning(rows: Row[]): Promise<Row[]> {
    const nodes = parseSelect(this.selectClause ?? '*');
    const state: EmbedValues = { values: new Map() };
    const resolved = await resolveEmbeds(this.store, directReader(this.store), this.table, rows, nodes, [], state);
    return resolved.map((row) => project(this.table, row, nodes, state));
  }

  private async runMutation(): Promise<{ rows: Row[] | null; count: number }> {
    const { own, embedded } = this.splitFilters();
    if (embedded.length > 0) throw new DbError('PGRST100', 'Filtre sur une table jointe interdit en écriture');
    const table = this.table;
    const now = new Date().toISOString();

    const affected = await this.store.runTransaction(async (tx) => {
      const reader = transactionReader(tx);
      const collection = this.store.collection(table);
      const targets = async () => (await fetchCandidates(this.store, reader, table, own)).filter((row) => matches(row, own));

      if (this.operation === 'delete') {
        const rows = await targets();
        const plan: DeletionPlan = { deletes: new Map(), nullify: new Map(), restricted: [] };
        await planDeletion(this.store, reader, table, rows, plan);
        const blocking = plan.restricted.find((entry) => !plan.deletes.has(`${entry.table}/${entry.id}`));
        if (blocking) throw new DbError('23503', `Suppression impossible : ${blocking.table} référence encore cette ligne (${blocking.fk.name})`);
        for (const entry of plan.deletes.values()) {
          tx.delete(this.store.collection(entry.table).doc(entry.id));
          writeUniqueKeys(this.store, tx, entry.table, entry.row, null);
        }
        for (const [key, entry] of plan.nullify) {
          if (plan.deletes.has(key)) continue;
          tx.set(this.store.collection(entry.table).doc(entry.id), encodeRow(entry.table, entry.row));
          writeUniqueKeys(this.store, tx, entry.table, entry.previous, entry.row);
        }
        return rows;
      }

      const ops: WriteOp[] = [];
      if (this.operation === 'update') {
        for (const previous of await targets()) {
          const next = applyPatch(table, previous, this.patch);
          beforeUpdate(table, previous, next, now);
          ops.push({ kind: 'update', table, row: next, previous, previousId: docIdFor(table, previous) });
        }
      } else {
        const conflictColumns = this.onConflict ?? tableSchema(table).primaryKey;
        for (const input of this.payload) {
          const candidate = completeRow(table, input, now);
          let existing: Row | null = null;
          // Une valeur NULL dans la cible de conflit ne peut entrer en conflit avec aucune ligne.
          if (this.operation === 'upsert' && conflictColumns.every((column) => candidate[column] !== null)) {
            const values = conflictColumns.map((column) => candidate[column]);
            const constraint = (tableSchema(table).unique ?? []).find((unique) => !unique.where && unique.columns.join(',') === conflictColumns.join(','));
            if (constraint) {
              const [owner] = await reader.refs([collection.firestore.collection(UNIQUE_KEYS).doc(uniqueKey(table, constraint.columns, values))]);
              const [row] = owner ? toRows(table, await reader.refs([collection.doc(owner.data.id as string)])) : [];
              existing = row ?? null;
            } else {
              const conflictFilters: Filter[] = conflictColumns.map((column, index) => ({ kind: 'cmp', column, op: 'eq', value: values[index] }));
              existing = (await fetchCandidates(this.store, reader, table, conflictFilters)).find((row) => matches(row, conflictFilters)) ?? null;
            }
          }
          if (existing && this.ignoreDuplicates) continue;
          if (existing) {
            const next = applyPatch(table, existing, input);
            beforeUpdate(table, existing, next, now);
            ops.push({ kind: 'update', table, row: next, previous: existing, previousId: docIdFor(table, existing) });
          } else {
            ops.push({ kind: 'create', table, row: candidate });
          }
        }
      }

      for (const op of ops) validateRow(op.table, op.row);
      await checkIntegrity(this.store, reader, ops);
      for (const op of ops) {
        const ref = collection.doc(docIdFor(table, op.row));
        if (op.kind === 'create') tx.create(ref, encodeRow(table, op.row));
        else tx.set(ref, encodeRow(table, op.row));
        writeUniqueKeys(this.store, tx, table, op.previous ?? null, op.row);
      }
      return ops.map((op) => op.row);
    });

    return { rows: this.returning ? await this.projectReturning(affected) : null, count: affected.length };
  }
}
