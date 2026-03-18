export function normalizeQScript(source: string) {
  const statements: string[] = [];
  let buffer = '';
  let delimiterDepth = 0;

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || (delimiterDepth === 0 && line.startsWith('/'))) {
      continue;
    }

    buffer = buffer ? `${buffer} ${line}` : line;
    delimiterDepth += countChar(line, '{');
    delimiterDepth -= countChar(line, '}');
    delimiterDepth += countChar(line, '(');
    delimiterDepth -= countChar(line, ')');
    delimiterDepth += countChar(line, '[');
    delimiterDepth -= countChar(line, ']');

    if (delimiterDepth <= 0) {
      // q rejects a trailing `;` immediately before a closing delimiter, but
      // learners often format multiline tables that way while editing.
      statements.push(buffer.replace(/;\s*([\)\]])/g, '$1'));
      buffer = '';
      delimiterDepth = 0;
    }
  }

  if (buffer) {
    statements.push(buffer.replace(/;\s*([\)\]])/g, '$1'));
  }

  return statements;
}

export function qString(value: string) {
  return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

function countChar(value: string, target: string) {
  return [...value].filter((char) => char === target).length;
}
