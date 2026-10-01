// Analyse d'un sous-ensemble de Markdown (celui des cours du centre) : titres, paragraphes, listes,
// tableaux, blocs de code, citations et encadrés « > [!tip] Titre » (repliables avec « - »).
// Le rendu (components/course/CourseMarkdown) construit des éléments React : jamais de HTML injecté.

export type Block =
  | { type: 'heading'; depth: number; text: string }
  | { type: 'paragraph'; lines: string[] }
  | { type: 'list'; items: ListItem[] }
  | { type: 'table'; header: string[]; rows: string[][] }
  | { type: 'code'; lang: string; lines: string[] }
  | { type: 'callout'; kind: string; title: string; collapsible: 'open' | 'closed' | null; blocks: Block[] }
  | { type: 'quote'; blocks: Block[] }
  | { type: 'hr' };

export interface ListItem {
  depth: number;
  marker: string | null; // « 3. » pour une liste numérotée, null pour une puce
  text: string;
}

const LIST_ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;

function splitRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, '|'));
}

const isSeparatorRow = (line: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);

export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index]!;

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = /^```\s*(\w*)/.exec(line);
    if (fence) {
      const body: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index]!.startsWith('```')) body.push(lines[index++]!);
      index += 1;
      blocks.push({ type: 'code', lang: fence[1] ?? '', lines: body });
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      blocks.push({ type: 'heading', depth: heading[1]!.length, text: heading[2]!.trim() });
      index += 1;
      continue;
    }

    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      blocks.push({ type: 'hr' });
      index += 1;
      continue;
    }

    if (line.startsWith('>')) {
      const inner: string[] = [];
      while (index < lines.length && lines[index]!.startsWith('>')) inner.push(lines[index++]!.replace(/^>\s?/, ''));
      const callout = /^\[!(\w+)\]([+-])?\s*(.*)$/.exec(inner[0] ?? '');
      if (callout) {
        blocks.push({
          type: 'callout',
          kind: callout[1]!.toLowerCase(),
          title: callout[3]!.trim(),
          collapsible: callout[2] === '-' ? 'closed' : callout[2] === '+' ? 'open' : null,
          blocks: parseMarkdown(inner.slice(1).join('\n')),
        });
      } else {
        blocks.push({ type: 'quote', blocks: parseMarkdown(inner.join('\n')) });
      }
      continue;
    }

    if (line.trim().startsWith('|') && index + 1 < lines.length && isSeparatorRow(lines[index + 1]!)) {
      const header = splitRow(line);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && lines[index]!.trim().startsWith('|')) rows.push(splitRow(lines[index++]!));
      blocks.push({ type: 'table', header, rows });
      continue;
    }

    if (LIST_ITEM.test(line)) {
      const items: ListItem[] = [];
      while (index < lines.length) {
        const current = lines[index]!;
        const item = LIST_ITEM.exec(current);
        if (item) {
          items.push({ depth: Math.floor(item[1]!.replace(/\t/g, '  ').length / 2), marker: /\d/.test(item[2]!) ? item[2]! : null, text: item[3]! });
          index += 1;
        } else if (current.trim() && /^\s+/.test(current) && items.length) {
          // Ligne de continuation indentée.
          items[items.length - 1]!.text += ` ${current.trim()}`;
          index += 1;
        } else {
          break;
        }
      }
      blocks.push({ type: 'list', items });
      continue;
    }

    const paragraph: string[] = [];
    while (
      index < lines.length &&
      lines[index]!.trim() &&
      !/^(#{1,6}\s|```|>|\s*(-{3,}|\*{3,})\s*$)/.test(lines[index]!) &&
      !LIST_ITEM.test(lines[index]!) &&
      !(lines[index]!.trim().startsWith('|') && isSeparatorRow(lines[index + 1] ?? ''))
    ) {
      paragraph.push(lines[index++]!.trim());
    }
    if (paragraph.length) blocks.push({ type: 'paragraph', lines: paragraph });
    else index += 1;
  }
  return blocks;
}

// ─────────────────────────────────────────────────────────────
// Repérage de l'italien (boutons d'écoute)
// ─────────────────────────────────────────────────────────────

export const stripInline = (text: string) =>
  text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .trim();

// En-têtes de colonnes dont les cellules sont en italien (vocabulaire, conjugaisons, exemples).
const ITALIAN_HEADER = /^(italien|italiano|exemples?|formule|singulier|pluriel|infinitif|futur|participe|direct|indirect|verbe|pronom|nom italien|personne|masculin|féminin|informel|formel|mot|expression|phrase)/i;

export function italianColumns(header: string[]): boolean[] {
  return header.map((cell) => {
    const label = stripInline(cell);
    if (!label) return false;
    return ITALIAN_HEADER.test(label) || /^[a-zà-ù]/.test(label);
  });
}

// Texte à lire pour une cellule : les passages en italique s'ils existent (« *ho* (j'ai) = « o » » → « ho »),
// sinon la cellule entière.
export function speakableText(cell: string): string | null {
  const italics = [...cell.matchAll(/(?<!\*)\*([^*]+)\*(?!\*)/g)].map((match) => match[1]!.trim());
  const text = italics.length ? italics.join(', ') : stripInline(cell).replace(/^\d+\.\s+/, '');
  const clean = text.replace(/[☐☑—–-]+$/g, '').trim();
  return clean && clean !== '—' && /[a-zA-Zà-ùÀ-Ù]/.test(clean) ? clean : null;
}

// « Marco : Ciao! » → { speaker: 'Marco', text: 'Ciao!' }
export function dialogueLine(line: string): { speaker: string | null; text: string } {
  const match = /^\s*([A-ZÀ-Ý][\p{L}' .-]{0,30}?)\s*:\s+(.+)$/u.exec(line);
  return match ? { speaker: match[1]!.trim(), text: match[2]!.trim() } : { speaker: null, text: line.trim() };
}

export const isTranslationHeading = (heading: string) => /traduction|translation/i.test(heading);

// Mots et expressions courts du cours, proposés par l'assistant de prononciation.
export function collectItalianSnippets(blocks: Block[], limit = 80): string[] {
  const found = new Set<string>();
  const visit = (list: Block[]) => {
    for (const block of list) {
      if (block.type === 'table') {
        const columns = italianColumns(block.header);
        const firstItalian = columns.indexOf(true);
        if (firstItalian < 0 || /personne/i.test(block.header[firstItalian] ?? '')) continue;
        for (const row of block.rows) {
          const text = speakableText(row[firstItalian] ?? '');
          if (text && text.length <= 40) found.add(text);
        }
      } else if (block.type === 'callout' || block.type === 'quote') {
        visit(block.blocks);
      }
    }
  };
  visit(blocks);
  return [...found].slice(0, limit);
}
