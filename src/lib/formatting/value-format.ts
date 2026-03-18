type JsonScalar = null | boolean | number | string;

const INDENT = '  ';
const HORIZONTAL_BLOCK_GAP = '  ';

export class StructuredConsoleFormatter {
  private pendingLines: string[] | null = null;

  push(text: string): string[] {
    const trimmed = text.trim();

    if (this.pendingLines) {
      this.pendingLines.push(trimmed);
      if (!isBalancedJsonText(this.pendingLines.join('\n'))) {
        return [];
      }

      const joined = this.pendingLines.join('\n');
      this.pendingLines = null;
      return [formatConsoleJsonValue(joined) ?? joined];
    }

    if (!isStructuredJsonStart(trimmed)) {
      return [text];
    }

    if (!isBalancedJsonText(trimmed)) {
      this.pendingLines = [trimmed];
      return [];
    }

    return [formatConsoleJsonValue(trimmed) ?? text];
  }

  flush(): string[] {
    if (!this.pendingLines) {
      return [];
    }

    const joined = this.pendingLines.join('\n');
    this.pendingLines = null;
    return [joined];
  }
}

export function formatDisplayValue(value: unknown): string {
  return formatValue(value, 0, true);
}

export function formatConsoleJsonValue(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed || !/^[\[{]/.test(trimmed)) {
    return null;
  }

  try {
    return formatDisplayValue(JSON.parse(trimmed));
  } catch {
    return null;
  }
}

export function isStructuredJsonStart(text: string): boolean {
  return /^[\[{]/.test(text.trim());
}

export function isBalancedJsonText(text: string): boolean {
  let depth = 0;
  let inString = false;
  let escaping = false;

  for (const char of text) {
    if (inString) {
      if (escaping) {
        escaping = false;
        continue;
      }
      if (char === '\\') {
        escaping = true;
        continue;
      }
      if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '[' || char === '{') {
      depth += 1;
    } else if (char === ']' || char === '}') {
      depth -= 1;
      if (depth < 0) {
        return false;
      }
    }
  }

  return depth === 0 && !inString && !escaping;
}

function formatValue(value: unknown, indentLevel: number, topLevel = false): string {
  if (Array.isArray(value)) {
    return formatArray(value, indentLevel, topLevel);
  }
  if (isPlainObject(value)) {
    return formatObject(value, indentLevel);
  }
  return formatScalar(value as JsonScalar);
}

function formatArray(value: unknown[], indentLevel: number, topLevel: boolean): string {
  const shape = getUniformScalarShape(value);
  if (shape) {
    if (shape.length <= 1) {
      return `[${value.map((item) => formatScalar(item as JsonScalar)).join(' ')}]`;
    }
    return formatUniformArray(value, shape, topLevel);
  }

  if (value.length === 0) {
    return '[]';
  }

  const items = value.map((item) => formatValue(item, indentLevel + 1));
  const inline = `[${items.join(' ')}]`;
  if (items.every((item) => !item.includes('\n')) && inline.length <= 80) {
    return inline;
  }

  const indent = INDENT.repeat(indentLevel);
  const childIndent = INDENT.repeat(indentLevel + 1);
  return [
    '[',
    ...items.flatMap((item) => indentBlock(item, childIndent)),
    `${indent}]`,
  ].join('\n');
}

function formatUniformArray(value: unknown[], shape: number[], topLevel: boolean): string {
  const lines = formatUniformArrayLines(value, shape);
  if (shape.length === 2 || topLevel) {
    return lines.join('\n');
  }

  return lines
    .map((line) => `${INDENT}${line}`)
    .join('\n');
}

function formatUniformArrayLines(value: unknown[], shape: number[]): string[] {
  if (shape.length === 2) {
    return formatMatrixLines(value as JsonScalar[][]);
  }

  const childShape = shape.slice(1);
  const childBlocks = (value as unknown[][]).map((child) => formatUniformArrayLines(child, childShape));

  if (shape.length % 2 === 1) {
    return joinBlocksHorizontally(childBlocks);
  }

  return joinBlocksVertically(childBlocks);
}

function formatMatrixLines(rows: JsonScalar[][]): string[] {
  if (rows.length === 0) {
    return ['[]'];
  }

  const textRows = rows.map((row) => row.map((item) => formatScalar(item)));
  const columnCount = textRows[0]?.length ?? 0;
  const widths = Array.from({ length: columnCount }, (_unused, columnIndex) =>
    Math.max(...textRows.map((row) => row[columnIndex]?.length ?? 0))
  );
  const numericColumns = Array.from({ length: columnCount }, (_unused, columnIndex) =>
    rows.every((row) => typeof row[columnIndex] === 'number')
  );

  return textRows.map((row) =>
    row
      .map((cell, columnIndex) => {
        const width = widths[columnIndex] ?? cell.length;
        return numericColumns[columnIndex] ? cell.padStart(width) : cell.padEnd(width);
      })
      .join(' ')
      .trimEnd()
  );
}

function joinBlocksHorizontally(blocks: string[][]): string[] {
  const widths = blocks.map((block) => Math.max(...block.map((line) => line.length), 0));
  const height = Math.max(...blocks.map((block) => block.length), 0);
  const gap = HORIZONTAL_BLOCK_GAP;

  return Array.from({ length: height }, (_unused, rowIndex) =>
    blocks
      .map((block, blockIndex) => (block[rowIndex] ?? '').padEnd(widths[blockIndex] ?? 0))
      .join(gap)
      .trimEnd()
  );
}

function joinBlocksVertically(blocks: string[][]): string[] {
  return blocks.flatMap((block, blockIndex) => (blockIndex === 0 ? block : ['', ...block]));
}

function formatObject(value: Record<string, unknown>, indentLevel: number): string {
  const entries = Object.entries(value);
  if (entries.length === 0) {
    return '{}';
  }

  const rendered = entries.map(([key, entryValue]) => ({
    key: JSON.stringify(key),
    value: formatValue(entryValue, indentLevel + 1),
  }));

  const inline = `{ ${rendered.map((entry) => `${entry.key}: ${entry.value}`).join(', ')} }`;
  if (rendered.every((entry) => !entry.value.includes('\n')) && inline.length <= 100) {
    return inline;
  }

  const indent = INDENT.repeat(indentLevel);
  const childIndent = INDENT.repeat(indentLevel + 1);
  const lines = ['{'];

  for (const entry of rendered) {
    if (entry.value.includes('\n')) {
      lines.push(`${childIndent}${entry.key}:`);
      lines.push(...indentBlock(entry.value, `${childIndent}${INDENT}`));
    } else {
      lines.push(`${childIndent}${entry.key}: ${entry.value}`);
    }
  }

  lines.push(`${indent}}`);
  return lines.join('\n');
}

function indentBlock(text: string, indent: string): string[] {
  return text.split('\n').map((line) => `${indent}${line}`);
}

function formatScalar(value: JsonScalar): string {
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return 'NaN';
    if (!Number.isFinite(value)) return value > 0 ? 'Infinity' : '-Infinity';
    if (Object.is(value, -0)) return '-0';
    return String(value);
  }
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  return String(value);
}

function getUniformScalarShape(value: unknown): number[] | null {
  if (!Array.isArray(value)) {
    return isScalar(value) ? [] : null;
  }

  if (value.length === 0) {
    return [0];
  }

  const childShapes = value.map((item) => getUniformScalarShape(item));
  if (childShapes.some((shape) => !shape)) {
    return null;
  }

  const [firstShape, ...restShapes] = childShapes as number[][];
  if (restShapes.some((shape) => !sameShape(shape, firstShape))) {
    return null;
  }

  return [value.length, ...firstShape];
}

function sameShape(left: number[], right: number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function isScalar(value: unknown): value is JsonScalar {
  return value == null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string';
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
