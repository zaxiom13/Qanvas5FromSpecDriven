import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const workspaceRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const runtimeControlModule = loadTsModule(path.join(workspaceRoot, 'src', 'lib', 'state', 'runtime-control-fsm.ts'));
const {
  beginRuntimeStart,
  beginRuntimeStop,
  completeQueuedRuntimeStep,
  completeRuntimeStart,
  completeRuntimeStop,
  createRuntimeControlState,
  failRuntime,
  pauseRuntime,
  queueRuntimeStep,
  recordRuntimeFrame,
  resumeRuntime,
} = runtimeControlModule.exports;

test('runtime control step startup lands in paused setup mode', () => {
  let state = createRuntimeControlState();
  state = beginRuntimeStart(state, 'step');

  assert.equal(state.mode, 'starting');
  assert.equal(state.startMode, 'step');

  state = completeRuntimeStart(state);

  assert.equal(state.mode, 'paused');
  assert.equal(state.frameNumber, 0);
  assert.equal(state.pendingSteps, 0);
  assert.equal(state.startMode, null);
});

test('runtime control resume clears queued manual steps', () => {
  let state = createRuntimeControlState();
  state = completeRuntimeStart(beginRuntimeStart(state, 'run'));
  state = queueRuntimeStep(state);

  assert.equal(state.mode, 'paused');
  assert.equal(state.pendingSteps, 1);

  state = resumeRuntime(state);

  assert.equal(state.mode, 'running');
  assert.equal(state.pendingSteps, 0);
});

test('runtime control manual step bookkeeping increments frames and drains the queue', () => {
  let state = createRuntimeControlState();
  state = completeRuntimeStart(beginRuntimeStart(state, 'run'));
  state = queueRuntimeStep(state);
  state = queueRuntimeStep(state);

  assert.equal(state.mode, 'paused');
  assert.equal(state.pendingSteps, 2);

  state = recordRuntimeFrame(state, 'manual');
  state = completeQueuedRuntimeStep(state);

  assert.equal(state.frameNumber, 1);
  assert.equal(state.pendingSteps, 1);
  assert.equal(state.mode, 'paused');
});

test('runtime control random button mashing preserves invariants', () => {
  let state = createRuntimeControlState();
  const random = createPrng(20260313);

  for (let index = 0; index < 2_000; index += 1) {
    const action = Math.floor(random() * 7);

    switch (action) {
      case 0:
        state = clickRun(state);
        break;
      case 1:
        state = clickStep(state);
        break;
      case 2:
        state = clickPauseResume(state);
        break;
      case 3:
        state = deliverFrame(state);
        break;
      case 4:
        state = failRuntime(state);
        break;
      case 5:
        state = completeRuntimeStop(beginRuntimeStop(state));
        break;
      case 6:
        state = completeRuntimeStart(beginRuntimeStart(state, random() > 0.5 ? 'run' : 'step'));
        break;
      default:
        break;
    }

    assertRuntimeInvariants(state);
  }
});

function clickRun(state) {
  if (state.mode === 'running' || state.mode === 'paused') {
    return completeRuntimeStop(beginRuntimeStop(state));
  }

  return completeRuntimeStart(beginRuntimeStart(state, 'run'));
}

function clickStep(state) {
  if (state.mode === 'idle' || state.mode === 'error') {
    return completeRuntimeStart(beginRuntimeStart(state, 'step'));
  }

  return queueRuntimeStep(state);
}

function clickPauseResume(state) {
  if (state.mode === 'paused') {
    return resumeRuntime(state);
  }

  return pauseRuntime(state);
}

function deliverFrame(state) {
  if (state.mode === 'running') {
    return recordRuntimeFrame(state, 'continuous');
  }

  if (state.mode === 'paused' && state.pendingSteps > 0) {
    return completeQueuedRuntimeStep(recordRuntimeFrame(state, 'manual'));
  }

  return state;
}

function assertRuntimeInvariants(state) {
  assert.ok(state.frameNumber >= 0);
  assert.ok(state.pendingSteps >= 0);

  if (state.mode !== 'paused') {
    assert.equal(state.pendingSteps, 0);
  }

  if (state.mode === 'starting') {
    assert.ok(state.startMode === 'run' || state.startMode === 'step');
  } else {
    assert.equal(state.startMode, null);
  }

  if (state.mode === 'idle' || state.mode === 'error') {
    assert.equal(state.frameNumber, 0);
    assert.equal(state.pendingSteps, 0);
  }
}

function createPrng(seed) {
  let current = seed >>> 0;
  return () => {
    current = (current * 1664525 + 1013904223) >>> 0;
    return current / 0x1_0000_0000;
  };
}

function loadTsModule(filePath) {
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
    require(id) {
      throw new Error(`Unexpected require in ${filePath}: ${id}`);
    },
  };

  vm.runInNewContext(compiled, sandbox, { filename: filePath });
  return {
    sandbox,
    exports: Object.keys(sandbox.module.exports).length ? sandbox.module.exports : sandbox.exports,
  };
}
