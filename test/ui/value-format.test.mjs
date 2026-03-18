import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const workspaceRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const valueFormatModule = loadTsModule(path.join(workspaceRoot, 'src', 'lib', 'formatting', 'value-format.ts'));
const {
  StructuredConsoleFormatter,
  formatDisplayValue,
} = valueFormatModule.exports;

test('value formatter prints vectors without JSON commas', () => {
  assert.equal(formatDisplayValue([1, 2, 3, 4]), '[1 2 3 4]');
});

test('value formatter prints matrices as aligned grids', () => {
  assert.equal(
    formatDisplayValue([
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ]),
    ['1 0 0 0', '0 1 0 0', '0 0 1 0', '0 0 0 1'].join('\n')
  );
});

test('value formatter lays rank-3 arrays out side by side', () => {
  assert.equal(
    formatDisplayValue([
      [
        [1, 2],
        [3, 4],
      ],
      [
        [5, 6],
        [7, 8],
      ],
    ]),
    ['1 2  5 6', '3 4  7 8'].join('\n')
  );
});

test('structured console formatter buffers multiline JSON arrays into one grid block', () => {
  const formatter = new StructuredConsoleFormatter();

  assert.equal(JSON.stringify(formatter.push('[')), '[]');
  assert.equal(JSON.stringify(formatter.push('[1, 0],')), '[]');
  assert.equal(JSON.stringify(formatter.push('[0, 1]')), '[]');
  assert.equal(JSON.stringify(formatter.push(']')), JSON.stringify(['1 0\n0 1']));
});

test('structured console formatter leaves plain stdout untouched', () => {
  const formatter = new StructuredConsoleFormatter();
  assert.equal(JSON.stringify(formatter.push('city | totalRevenue')), JSON.stringify(['city | totalRevenue']));
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
