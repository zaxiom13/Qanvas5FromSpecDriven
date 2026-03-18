import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const workspaceRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const practicePanelModule = loadTsModule(path.join(workspaceRoot, 'src', 'lib', 'view-models', 'practice-panel.ts'));
const {
  PRACTICE_CHART,
  createPracticeChartView,
  createPracticePanelViewModel,
  formatPracticeAxisValue,
} = practicePanelModule.exports;

test('practice panel view model groups challenges by difficulty in the expected order', () => {
  const warmupOne = challenge('warmup-one', 'warmup');
  const coreOne = challenge('core-one', 'core');
  const warmupTwo = challenge('warmup-two', 'warmup');

  const viewModel = createPracticePanelViewModel([warmupOne, coreOne, warmupTwo], coreOne);

  assert.deepEqual(plain(viewModel.challengeGroups.map((group) => group.difficulty)), ['warmup', 'core']);
  assert.deepEqual(plain(viewModel.challengeGroups[0].challenges.map((entry) => entry.id)), ['warmup-one', 'warmup-two']);
  assert.deepEqual(plain(viewModel.challengeGroups[1].challenges.map((entry) => entry.id)), ['core-one']);
  assert.equal(viewModel.activeChallenge.id, 'core-one');
});

test('practice panel chart view precomputes bar geometry and axis labels', () => {
  const chart = createPracticeChartView({
    kind: 'chart',
    id: 'temps',
    label: 'Temps',
    chartType: 'bar',
    xKey: 'day',
    yKey: 'tempC',
    points: [
      { day: 'Mon', tempC: 18 },
      { day: 'Tue', tempC: 22 },
      { day: 'Wed', tempC: 20 },
      { day: 'Thu', tempC: 27 },
      { day: 'Fri', tempC: 25 },
      { day: 'Sat', tempC: 31 },
      { day: 'Sun', tempC: 16 },
    ],
  });

  assert.equal(chart.yMin, 16);
  assert.equal(chart.yMax, 31);
  assert.equal(chart.yMid, 23.5);
  assert.equal(chart.barWidth, 30);
  assert.deepEqual(plain(chart.bars[0]), { x: 29, y: 116, height: 16 });
  assert.deepEqual(plain(chart.bars[6]), { x: 281, y: 132, height: 0 });
  assert.deepEqual(plain(chart.labels[0]), { x: 44, value: 'Mon' });
  assert.deepEqual(plain(chart.labels[6]), { x: 296, value: 'Sun' });
  assert.equal(chart.gridPath, `M ${PRACTICE_CHART.left} ${PRACTICE_CHART.bottom} H ${PRACTICE_CHART.right} M ${PRACTICE_CHART.left} ${(PRACTICE_CHART.top + PRACTICE_CHART.bottom) / 2} H ${PRACTICE_CHART.right} M ${PRACTICE_CHART.left} ${PRACTICE_CHART.top} H ${PRACTICE_CHART.right}`);
  assert.equal(formatPracticeAxisValue(1200), '1k');
});

test('practice panel chart view precomputes line geometry', () => {
  const chart = createPracticeChartView({
    kind: 'chart',
    id: 'signal',
    label: 'Signal',
    chartType: 'line',
    xKey: 'index',
    yKey: 'value',
    points: [
      { index: 0, value: 3 },
      { index: 1, value: 7 },
      { index: 2, value: 4 },
      { index: 3, value: 8 },
      { index: 4, value: 5 },
      { index: 5, value: 2 },
      { index: 6, value: 9 },
      { index: 7, value: 1 },
      { index: 8, value: 6 },
      { index: 9, value: 3 },
    ],
  });

  assert.equal(chart.linePath, 'M 44 102 L 72 42 L 100 87 L 128 27 L 156 72 L 184 117 L 212 12 L 240 132 L 268 57 L 296 102');
  assert.deepEqual(plain(chart.dots[0]), { cx: 44, cy: 102 });
  assert.deepEqual(plain(chart.dots[9]), { cx: 296, cy: 102 });
});

function challenge(id, difficulty) {
  return {
    id,
    title: id,
    difficulty,
    prompt: '',
    hint: '',
    answerLabel: '',
    answerExpression: '',
    expected: null,
    starterCode: '',
    datasets: [],
  };
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
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
