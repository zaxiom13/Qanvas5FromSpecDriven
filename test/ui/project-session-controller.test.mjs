import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const workspaceRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const projectSessionModule = loadTsModule(path.join(workspaceRoot, 'src', 'lib', 'state', 'project-session.ts'));
const { ProjectSessionController } = projectSessionModule.exports;

test('project session createFile appends a q extension and activates the new file', () => {
  const host = createHost();
  host.newFileName = 'notes';

  const created = createController().createFile(host);

  assert.equal(created, true);
  assert.equal(host.activeFileName, 'notes.q');
  assert.equal(host.files.at(-1)?.name, 'notes.q');
  assert.equal(host.markDirtyCalls.length, 1);
  assert.equal(host.markDirtyCalls[0]?.refreshRuntime, true);
});

test('project session renameFile preserves q extension behavior and retargets the active file', () => {
  const host = createHost({
    files: [
      { name: 'sketch.q', content: 'sketch' },
      { name: 'old.q', content: 'old' },
    ],
    activeFileName: 'old.q',
  });

  const renamed = createController().renameFile(host, 'old.q', 'renamed');

  assert.equal(renamed, true);
  assert.equal(host.activeFileName, 'renamed.q');
  assert.deepEqual(host.files.map((file) => file.name), ['sketch.q', 'renamed.q']);
});

test('project session deleteFile keeps sketch.q protected and reselects the first file when needed', () => {
  const host = createHost({
    files: [
      { name: 'sketch.q', content: 'sketch' },
      { name: 'palette.q', content: 'palette' },
    ],
    activeFileName: 'palette.q',
  });

  const deleted = createController().deleteFile(host, 'palette.q');
  const blocked = createController().deleteFile(host, 'sketch.q');

  assert.equal(deleted, true);
  assert.equal(blocked, false);
  assert.equal(host.activeFileName, 'sketch.q');
  assert.deepEqual(host.files.map((file) => file.name), ['sketch.q']);
});

test('project session updateActiveFileContent skips no-op edits', () => {
  const host = createHost();

  const unchanged = createController().updateActiveFileContent(host, 'seed');
  const changed = createController().updateActiveFileContent(host, 'next');

  assert.equal(unchanged, false);
  assert.equal(changed, true);
  assert.equal(host.files[0]?.content, 'next');
});

function createController() {
  return new ProjectSessionController({
    files: { pickAssets: async () => [] },
    projects: {
      root: async () => '',
      list: async () => [],
      read: async () => {
        throw new Error('not used');
      },
      save: async () => {
        throw new Error('not used');
      },
    },
    runtime: {
      detect: async () => null,
      start: async () => ({}),
      frame: async () => [],
      query: async () => ({ ok: true }),
      stop: async () => {},
      onStdout: () => () => {},
      onStderr: () => () => {},
      onExit: () => () => {},
    },
    menu: {
      on: () => () => {},
      onNewSketch: () => () => {},
      onOpenProject: () => () => {},
      onSave: () => () => {},
      onSaveAs: () => () => {},
      onToggleComment: () => () => {},
    },
  });
}

function createHost(overrides = {}) {
  return {
    projectPath: null,
    projectName: 'untitled',
    projectNameDraft: 'untitled',
    files: [{ name: 'sketch.q', content: 'seed' }],
    activeFileName: 'sketch.q',
    assets: [],
    unsaved: true,
    projectsRoot: '',
    projectLibrary: [],
    projectLibraryLoading: false,
    newFileName: '',
    renamingProject: false,
    markDirtyCalls: [],
    consoleEntries: [],
    setProjectName(value) {
      this.projectName = value;
      this.projectNameDraft = value;
    },
    markDirty(options = {}) {
      this.markDirtyCalls.push(options);
    },
    clearAutosave() {},
    appendConsole(type, text) {
      this.consoleEntries.push({ type, text });
    },
    ...overrides,
  };
}

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
