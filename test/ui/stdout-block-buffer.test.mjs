import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const workspaceRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const stdoutBlockBufferModule = loadTsModule(path.join(workspaceRoot, 'electron', 'stdout-block-buffer.ts'));
const { StdoutBlockBuffer } = stdoutBlockBufferModule.exports;

test('stdout block buffer emits grouped multiline output as one block', () => {
  const emitted = [];
  const buffer = new StdoutBlockBuffer((text) => emitted.push(text), 1_000);

  buffer.append('1 2  3  4');
  buffer.append('5 6  7  8');
  buffer.append('9 10 11 12');
  buffer.flush();

  assert.equal(JSON.stringify(emitted), JSON.stringify(['1 2  3  4\n5 6  7  8\n9 10 11 12']));
});

test('stdout block buffer preserves blank lines inside a block', () => {
  const emitted = [];
  const buffer = new StdoutBlockBuffer((text) => emitted.push(text), 1_000);

  buffer.append('1 2');
  buffer.append('');
  buffer.append('3 4');
  buffer.flush();

  assert.equal(JSON.stringify(emitted), JSON.stringify(['1 2\n\n3 4']));
});

function loadTsModule(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filePath,
  });

  const module = { exports: {} };
  const context = vm.createContext({
    module,
    exports: module.exports,
    require(id) {
      throw new Error(`Unexpected require in ${filePath}: ${id}`);
    },
    __dirname: path.dirname(filePath),
    __filename: filePath,
    console,
    process,
    setTimeout,
    clearTimeout,
  });

  new vm.Script(transpiled.outputText, { filename: filePath }).runInContext(context);
  return module;
}
