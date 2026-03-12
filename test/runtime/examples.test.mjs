import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const workspaceRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const bootSource = fs.readFileSync(path.join(workspaceRoot, 'runtime', 'boot.q'), 'utf8');
const { EXAMPLES } = loadTsExports(path.join(workspaceRoot, 'src', 'lib', 'examples.ts'));

const exampleInputs = {
  'click-painter': {
    mouse: [180, 220],
    mouseButtons: { left: true, middle: false, right: false },
    scroll: [0, 0],
    key: '',
    keys: [],
  },
  'drag-trail': {
    mouse: [240, 280],
    mouseButtons: { left: true, middle: false, right: false },
    scroll: [0, 0],
    key: '',
    keys: [],
  },
};

const expectedKinds = {
  'hello-circle': ['background', 'circle'],
  'color-grid': ['background', 'rect'],
  'breathing-ring': ['background', 'circle'],
  'line-weave': ['background', 'line'],
  'text-poster': ['background', 'text'],
  'image-stamp': ['background', 'image'],
  'particle-fountain': ['background', 'circle'],
  'click-painter': ['background', 'circle'],
  'drag-trail': ['background', 'circle'],
};

for (const example of EXAMPLES) {
  test(`example ${example.id} runs in real q`, () => {
    const input = exampleInputs[example.id] ?? {
      mouse: null,
      mouseButtons: { left: false, middle: false, right: false },
      scroll: [0, 0],
      key: '',
      keys: [],
    };

    const result = runSketch(example.code, {
      frameInfo: { frameNum: 0, time: 0, dt: 16 },
      input,
      canvas: { size: [650, 632], pixelRatio: 1 },
    });

    assert.equal(result.status, 0, `q exited with status ${result.status}`);
    assert.equal(result.stderr.trim(), '', `q wrote stderr for ${example.id}: ${result.stderr}`);

    const initLine = result.stdoutLines.find((line) => line.startsWith('__QANVAS_INIT__'));
    assert.ok(initLine, `missing init payload for ${example.id}`);

    const frameLines = result.stdoutLines.filter((line) => line.startsWith('__QANVAS_FRAME__'));
    assert.ok(frameLines.length > 0, `missing frame payload for ${example.id}`);

    const frame = JSON.parse(frameLines.at(-1).slice('__QANVAS_FRAME__'.length));
    assert.deepEqual(
      frame.map((command) => command.kind),
      expectedKinds[example.id],
      `unexpected commands for ${example.id}: ${JSON.stringify(frame)}`
    );
  });
}

function loadTsExports(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;

  const sandbox = {
    console,
    exports: {},
    module: { exports: {} },
    require,
  };

  vm.runInNewContext(compiled, sandbox, { filename: filePath });
  return Object.keys(sandbox.module.exports).length ? sandbox.module.exports : sandbox.exports;
}

function runSketch(code, payload) {
  const commands = [
    ...normalizeQScript(bootSource),
    ...normalizeQScript(code),
    '.qv.init[];',
    `.qv.frame[${qString(JSON.stringify(payload.frameInfo))};${qString(JSON.stringify(payload.input))};${qString(JSON.stringify(payload.canvas))}];`,
  ];

  const result = spawnSync('q', ['-q'], {
    cwd: workspaceRoot,
    encoding: 'utf8',
    input: `${commands.join('\n')}\n`,
  });

  return {
    ...result,
    stdoutLines: result.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
  };
}

function normalizeQScript(source) {
  const statements = [];
  let buffer = '';
  let braceDepth = 0;

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || (braceDepth === 0 && line.startsWith('/'))) {
      continue;
    }

    buffer = buffer ? `${buffer} ${line}` : line;
    braceDepth += countChar(line, '{');
    braceDepth -= countChar(line, '}');

    if (braceDepth <= 0) {
      statements.push(buffer);
      buffer = '';
      braceDepth = 0;
    }
  }

  if (buffer) {
    statements.push(buffer);
  }

  return statements;
}

function countChar(value, target) {
  return [...value].filter((char) => char === target).length;
}

function qString(value) {
  return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}
