import { Code, Text } from '@mantine/core';

interface Props {
  code: string;
}

type TokenKind = 'comment' | 'key' | 'string' | 'number' | 'boolean' | 'null' | 'document';

interface Segment {
  text: string;
  kind?: TokenKind;
}

const COLORS: Record<TokenKind, string> = {
  comment: 'var(--mantine-color-dark-2)',
  key: 'var(--mantine-color-cyan-3)',
  string: 'var(--mantine-color-green-3)',
  number: 'var(--mantine-color-orange-3)',
  boolean: 'var(--mantine-color-violet-3)',
  null: 'var(--mantine-color-red-3)',
  document: 'var(--mantine-color-yellow-3)',
};

function classifyValue(value: string): TokenKind | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed === '---' || trimmed === '...') return 'document';
  if (trimmed === 'true' || trimmed === 'false') return 'boolean';
  if (trimmed === 'null' || trimmed === '~') return 'null';
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(trimmed)) return 'number';
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    trimmed.startsWith('|') ||
    trimmed.startsWith('>')
  ) {
    return 'string';
  }
  return undefined;
}

function splitComment(line: string): [string, string] {
  let single = false;
  let double = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const prev = line[i - 1];
    if (ch === '"' && !single && prev !== '\\') double = !double;
    if (ch === "'" && !double) single = !single;
    if (ch === '#' && !single && !double && (i === 0 || /\s/.test(line[i - 1]))) {
      return [line.slice(0, i), line.slice(i)];
    }
  }
  return [line, ''];
}

function tokenizeLine(line: string): Segment[] {
  const [body, comment] = splitComment(line);
  const segments: Segment[] = [];
  const doc = body.trim();
  if (doc === '---' || doc === '...') {
    segments.push({ text: body, kind: 'document' });
  } else {
    const match = body.match(/^(\s*-\s*)?([^\s:{][^:]*):(.*)$/);
    if (match) {
      const prefix = match[1] ?? '';
      const key = match[2] ?? '';
      const value = match[3] ?? '';
      if (prefix) segments.push({ text: prefix });
      segments.push({ text: key, kind: 'key' }, { text: ':' });
      if (value) segments.push({ text: value, kind: classifyValue(value) });
    } else {
      segments.push({ text: body, kind: classifyValue(body) });
    }
  }
  if (comment) segments.push({ text: comment, kind: 'comment' });
  return segments;
}

export function YamlCode({ code }: Props) {
  if (!code) {
    return (
      <Text c="dimmed" p="md" size="sm">
        Kein YAML geladen.
      </Text>
    );
  }

  const lines = code.split('\n');
  return (
    <Code
      block
      className="yaml-code"
      style={{
        margin: 0,
        padding: 12,
        fontSize: 12,
        lineHeight: 1.5,
        fontFamily: 'var(--mantine-font-family-monospace)',
        background: 'var(--mantine-color-dark-8)',
        borderRadius: 8,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      {lines.map((line, lineIndex) => (
        <span key={lineIndex} className="yaml-code-line">
          <span className="yaml-code-line-number">{lineIndex + 1}</span>
          <span className="yaml-code-line-content">
            {tokenizeLine(line).map((segment, segmentIndex) => (
              <span key={segmentIndex} style={segment.kind ? { color: COLORS[segment.kind] } : undefined}>
                {segment.text}
              </span>
            ))}
          </span>
          {lineIndex < lines.length - 1 ? '\n' : null}
        </span>
      ))}
    </Code>
  );
}
