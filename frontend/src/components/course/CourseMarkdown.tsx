import './course.css';
import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { SLOW_RATE, speakItalian } from '../../lib/italian-voice';
import { dialogueLine, isTranslationHeading, italianColumns, parseMarkdown, speakableText, type Block } from '../../lib/markdown';
import { SpeakButton } from './SpeakButton';

// ── Rendu en ligne : gras, italique, code, liens http(s) ──

const INLINE = /(\*\*([^*]+)\*\*)|((?<![\w*])\*([^*\s][^*]*?)\*(?![\w*]))|(`([^`]+)`)|(\[([^\]]+)\]\((https?:\/\/[^)\s]+)\))/;

function renderInline(text: string, keyPrefix = 'i'): ReactNode[] {
  const nodes: ReactNode[] = [];
  let rest = text;
  let key = 0;
  while (rest) {
    const match = INLINE.exec(rest);
    if (!match) {
      nodes.push(rest);
      break;
    }
    if (match.index > 0) nodes.push(rest.slice(0, match.index));
    const id = `${keyPrefix}-${key++}`;
    if (match[2] !== undefined) nodes.push(<strong key={id}>{renderInline(match[2], id)}</strong>);
    else if (match[4] !== undefined) nodes.push(<em key={id}>{renderInline(match[4], id)}</em>);
    else if (match[6] !== undefined) nodes.push(<code key={id}>{match[6]}</code>);
    else
      nodes.push(
        <a key={id} href={match[9]} target="_blank" rel="noopener noreferrer">
          {match[8]}
        </a>,
      );
    rest = rest.slice(match.index + match[0].length);
  }
  return nodes;
}

const CALLOUT_ICONS: Record<string, string> = {
  tip: '💡',
  warning: '⚠️',
  caution: '⚠️',
  info: 'ℹ️',
  note: '📝',
  example: '📘',
  question: '❓',
  success: '✅',
};

// ── Blocs ──

interface RenderContext {
  heading: string;
}

function DialogueBlock({ lines, id }: { lines: string[]; id: string }) {
  const parsed = lines.map(dialogueLine).filter((line) => line.text);
  return (
    <div className="md-dialogue">
      <div className="md-dialogue-bar">
        <span>Dialogue</span>
        <span className="flex gap-1.5">
          <SpeakButton id={`${id}-all`} text={parsed.map((line) => line.text)} compact={false} label="Écouter tout" />
          <SpeakButton id={`${id}-slow`} text={parsed.map((line) => line.text)} compact={false} slow label="Lentement" />
        </span>
      </div>
      <ul>
        {parsed.map((line, index) => (
          <li key={index}>
            <SpeakButton id={`${id}-${index}`} text={line.text} />
            {line.speaker && <span className="md-speaker">{line.speaker}</span>}
            <span>{line.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TableBlock({ header, rows, id }: { header: string[]; rows: string[][]; id: string }) {
  const speakable = italianColumns(header);
  const hasHeader = header.some((cell) => cell.trim());
  return (
    <div className="md-table">
      <table>
        {hasHeader && (
          <thead>
            <tr>
              {header.map((cell, index) => (
                <th key={index}>{renderInline(cell)}</th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => {
                const text = speakable[cellIndex] ? speakableText(cell) : null;
                return (
                  <td key={cellIndex}>
                    {text ? (
                      <span className="md-speakable">
                        <SpeakButton id={`${id}-${rowIndex}-${cellIndex}`} text={text} />
                        <span>{renderInline(cell)}</span>
                      </span>
                    ) : (
                      renderInline(cell)
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderBlocks(blocks: Block[], context: RenderContext, prefix: string): ReactNode[] {
  return blocks.map((block, index) => {
    const id = `${prefix}-${index}`;
    switch (block.type) {
      case 'heading': {
        context.heading = block.text;
        const depth = Math.min(Math.max(block.depth, 2), 4);
        const Tag = `h${depth}` as 'h2' | 'h3' | 'h4';
        return <Tag key={id}>{renderInline(block.text)}</Tag>;
      }
      case 'paragraph':
        return (
          <p key={id}>
            {block.lines.map((line, lineIndex) => (
              <Fragment key={lineIndex}>
                {lineIndex > 0 && <br />}
                {renderInline(line, `${id}-${lineIndex}`)}
              </Fragment>
            ))}
          </p>
        );
      case 'list':
        return (
          <ul key={id} className="md-list">
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex} style={{ marginLeft: `${item.depth * 1.25}rem` }} className={item.marker ? 'is-ordered' : ''}>
                {item.marker && <span className="md-marker">{item.marker}</span>}
                <span>{renderInline(item.text, `${id}-${itemIndex}`)}</span>
              </li>
            ))}
          </ul>
        );
      case 'table':
        return <TableBlock key={id} id={id} header={block.header} rows={block.rows} />;
      case 'code':
        if (!isTranslationHeading(context.heading) && block.lang !== 'js' && block.lines.some((line) => line.trim())) {
          return <DialogueBlock key={id} id={id} lines={block.lines} />;
        }
        return (
          <pre key={id} className="md-pre">
            {block.lines.join('\n')}
          </pre>
        );
      case 'hr':
        return <hr key={id} />;
      case 'quote':
        return <blockquote key={id}>{renderBlocks(block.blocks, { ...context }, id)}</blockquote>;
      case 'callout': {
        const icon = CALLOUT_ICONS[block.kind] ?? 'ℹ️';
        const title = block.title || block.kind;
        const inner = renderBlocks(block.blocks, { ...context }, id);
        // Transcriptions des documents sonores : écoute possible avant d'afficher le texte.
        const transcript = /transcription/i.test(block.title) ? collectText(block.blocks) : null;
        const listen = transcript ? (
          <span className="md-callout-actions">
            <SpeakButton id={`${id}-doc`} text={transcript} compact={false} label="Écouter le document" />
            <SpeakButton id={`${id}-doc-slow`} text={transcript} compact={false} slow label="Lentement" />
          </span>
        ) : null;
        if (block.collapsible) {
          return (
            <div key={id} className={`md-callout is-${block.kind}`}>
              {listen}
              <details open={block.collapsible === 'open'}>
                <summary>
                  <span aria-hidden="true">{icon}</span> {renderInline(title)}
                </summary>
                <div className="md-callout-body">{inner}</div>
              </details>
            </div>
          );
        }
        return (
          <div key={id} className={`md-callout is-${block.kind}`}>
            <p className="md-callout-title">
              <span aria-hidden="true">{icon}</span> {renderInline(title)}
            </p>
            {listen}
            <div className="md-callout-body">{inner}</div>
          </div>
        );
      }
    }
  });
}

function collectText(blocks: Block[]): string[] {
  return blocks.flatMap((block) => {
    if (block.type === 'paragraph') return block.lines;
    if (block.type === 'list') return block.items.map((item) => item.text);
    if (block.type === 'code') return block.lines.map((line) => dialogueLine(line).text);
    if (block.type === 'callout' || block.type === 'quote') return collectText(block.blocks);
    return [];
  });
}

// ── Sélection → écoute ──

function useSelectionSpeech(container: React.RefObject<HTMLDivElement | null>) {
  const [selection, setSelection] = useState<{ text: string; top: number; left: number } | null>(null);

  const update = useCallback(() => {
    const current = window.getSelection();
    const text = current?.toString().trim() ?? '';
    if (!current || !text || text.length > 600 || current.rangeCount === 0 || !container.current?.contains(current.anchorNode)) {
      setSelection(null);
      return;
    }
    const rect = current.getRangeAt(0).getBoundingClientRect();
    setSelection({ text, top: Math.max(8, rect.top - 44), left: Math.min(window.innerWidth - 160, Math.max(8, rect.left + rect.width / 2 - 70)) });
  }, [container]);

  useEffect(() => {
    const hide = () => setSelection(null);
    document.addEventListener('selectionchange', update);
    window.addEventListener('scroll', hide, { passive: true });
    return () => {
      document.removeEventListener('selectionchange', update);
      window.removeEventListener('scroll', hide);
    };
  }, [update]);

  return selection;
}

export function CourseMarkdown({ source }: { source: string }) {
  const container = useRef<HTMLDivElement>(null);
  const selection = useSelectionSpeech(container);
  const blocks = parseMarkdown(source);

  return (
    <div ref={container} className="md-course">
      {renderBlocks(blocks, { heading: '' }, 'b')}
      {selection && (
        <div className="md-selection" style={{ top: selection.top, left: selection.left }}>
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => speakItalian(selection.text, { id: 'selection' })}>
            🔊 Écouter
          </button>
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => speakItalian(selection.text, { id: 'selection', rate: SLOW_RATE })}>
            🐢
          </button>
        </div>
      )}
    </div>
  );
}
