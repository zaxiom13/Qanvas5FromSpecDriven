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
const { normalizeQScript, qString } = loadTsExports(path.join(workspaceRoot, 'electron', 'q-script-utils.ts'));
const {
  PRACTICE_CHALLENGES,
  PRACTICE_SOLUTION_SNIPPETS,
  getPracticeSolutionSource,
} = loadTsExports(path.join(workspaceRoot, 'src', 'lib', 'practice-challenges.ts'));

test('practice solutions cover every challenge', () => {
  const missing = PRACTICE_CHALLENGES
    .filter((challenge) => typeof PRACTICE_SOLUTION_SNIPPETS[challenge.id] !== 'string' || !PRACTICE_SOLUTION_SNIPPETS[challenge.id].trim())
    .map((challenge) => challenge.id);

  assert.equal(JSON.stringify(missing), '[]');

  for (const challenge of PRACTICE_CHALLENGES) {
    const source = getPracticeSolutionSource(challenge.id);
    assert.match(source, /\nanswer:/, `missing answer assignment in ${challenge.id}`);
  }
});

for (const challenge of PRACTICE_CHALLENGES) {
  test(`practice solution ${challenge.id} verifies against expected output`, () => {
    const result = runBoot([
      ...normalizeQScript(getPracticeSolutionSource(challenge.id)),
      `.qv.emitjson["TRACE"; value parse ${qString(challenge.answerExpression)}];`,
    ]);

    assert.equal(result.status, 0, result.stderr);
    const trace = parseTaggedJson(result.stdoutLines, 'TRACE');
    assert.equal(JSON.stringify(trace), JSON.stringify(challenge.expected));
  });
}

function runBoot(commands) {
  const result = spawnSync('q', ['-q'], {
    cwd: workspaceRoot,
    encoding: 'utf8',
    input: `${[...normalizeQScript(bootSource), ...commands].join('\n')}\n`,
  });

  return {
    ...result,
    stdoutLines: normalizeStdout(result.stdout),
  };
}

function normalizeStdout(stdout) {
  return stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function findTaggedJson(lines, kind) {
  const prefix = `__QANVAS_${kind}__`;
  const line = lines.find((entry) => entry.startsWith(prefix));
  return line ? JSON.parse(line.slice(prefix.length)) : null;
}

function parseTaggedJson(lines, kind) {
  const value = findTaggedJson(lines, kind);
  assert.ok(value !== null, `missing ${kind} payload`);
  return value;
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
