import { describe, expect, it } from 'vitest';
import { pronunciationScore } from '../src/lib/italian-voice';
import { collectItalianSnippets, dialogueLine, italianColumns, parseMarkdown, speakableText } from '../src/lib/markdown';

const COURSE = `## Vocabulaire

| Italien | Français | Registre |
|---|---|---|
| Ciao! | Salut ! | informel |
| **Buongiorno!** | Bonjour ! | formel |

> [!tip] Astuce
> Les nationalités en **-ese** ne changent pas.

> [!example]- Corrigé
> 1. Buonasera

1. Premier
2. Second
   suite

\`\`\`text
Marco : Ciao! Sono Marco.
Grâce : Piacere!
\`\`\``;

describe('parseMarkdown', () => {
  const blocks = parseMarkdown(COURSE);

  it('reconnaît titres, tableaux, encadrés, listes et blocs de code', () => {
    expect(blocks.map((block) => block.type)).toEqual(['heading', 'table', 'callout', 'callout', 'list', 'code']);
    const [, , tip, example, list] = blocks;
    expect(tip).toMatchObject({ kind: 'tip', title: 'Astuce', collapsible: null });
    expect(example).toMatchObject({ kind: 'example', collapsible: 'closed' });
    expect(list).toMatchObject({ items: [{ marker: '1.', text: 'Premier' }, { marker: '2.', text: 'Second suite' }] });
  });

  it('propose les mots italiens du cours à l’assistant', () => {
    expect(collectItalianSnippets(blocks)).toEqual(['Ciao!', 'Buongiorno!']);
  });
});

describe('repérage de l’italien', () => {
  it('lit les colonnes en italien, pas les colonnes en français', () => {
    expect(italianColumns(['Italien', 'Français', 'Registre'])).toEqual([true, false, false]);
    expect(italianColumns(['Personne', 'parl**are**', 'Exemple'])).toEqual([true, true, true]);
    expect(italianColumns(['', 'Prononciation'])).toEqual([false, false]);
  });

  it('ne lit que les passages en italique quand la cellule mélange les langues', () => {
    expect(speakableText("*ho* (j'ai) = « o », *hanno* (ils ont)")).toBe('ho, hanno');
    expect(speakableText('**Buongiorno!**')).toBe('Buongiorno!');
    expect(speakableText('—')).toBeNull();
  });

  it('sépare l’interlocuteur de sa réplique', () => {
    expect(dialogueLine('Rossi  : Buongiorno! Come si chiama?')).toEqual({ speaker: 'Rossi', text: 'Buongiorno! Come si chiama?' });
    expect(dialogueLine('Ciao a tutti!')).toEqual({ speaker: null, text: 'Ciao a tutti!' });
  });
});

describe('pronunciationScore', () => {
  it('compare sans tenir compte des accents ni de la ponctuation', () => {
    expect(pronunciationScore('Mi chiamo Grâce.', 'mi chiamo grace')).toEqual({ score: 100, missing: [] });
    expect(pronunciationScore('Buongiorno, professoressa', 'buongiorno professore')).toEqual({ score: 50, missing: ['professoressa'] });
  });
});
