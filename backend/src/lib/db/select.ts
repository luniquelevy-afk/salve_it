// Analyse de la syntaxe de sélection héritée de PostgREST, conservée telle quelle dans les services :
// « id, name, alias:table!hint!inner(col, sous_table(col)), json->>clé, table(count) ».
import { DbError } from './types.js';

export type SelectNode =
  | { kind: 'star' }
  | { kind: 'count' }
  | { kind: 'column'; key: string; name: string; path: { key: string; asText: boolean }[] }
  | { kind: 'embed'; key: string; relation: string; hint: string | null; inner: boolean; children: SelectNode[] };

// Découpe au premier niveau (hors parenthèses).
export function splitTopLevel(input: string, separator = ','): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of input) {
    if (char === '(') depth++;
    if (char === ')') depth--;
    if (char === separator && depth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

const EMBED = /^(?:([a-z_][a-z0-9_]*):)?([a-z_][a-z0-9_]*)((?:![a-z_][a-z0-9_]*)*)\(([\s\S]*)\)$/i;
const COLUMN = /^(?:([a-z_][a-z0-9_]*):)?([a-z_][a-z0-9_]*)((?:->>?[a-z_][a-z0-9_]*)*)$/i;

export function parseSelect(input: string): SelectNode[] {
  const source = input.trim() === '' ? '*' : input;
  return splitTopLevel(source.replace(/\s+/g, ' ')).map((item): SelectNode => {
    if (item === '*') return { kind: 'star' };
    if (item === 'count') return { kind: 'count' };

    const embed = EMBED.exec(item);
    if (embed) {
      const [, alias, relation, modifiers, body] = embed as unknown as [string, string | undefined, string, string, string];
      const flags = modifiers.split('!').filter(Boolean);
      return {
        kind: 'embed',
        key: alias ?? relation,
        relation,
        hint: flags.find((flag) => flag !== 'inner' && flag !== 'left') ?? null,
        inner: flags.includes('inner'),
        children: parseSelect(body),
      };
    }

    const column = COLUMN.exec(item.replace(/\s/g, ''));
    if (column) {
      const [, alias, name, pathText] = column as unknown as [string, string | undefined, string, string];
      const path = [...pathText.matchAll(/(->>?)([a-z_][a-z0-9_]*)/gi)].map((match) => ({ key: match[2] as string, asText: match[1] === '->>' }));
      return { kind: 'column', key: alias ?? path.at(-1)?.key ?? name, name, path };
    }

    throw new DbError('PGRST100', `Sélection invalide : « ${item} »`);
  });
}
