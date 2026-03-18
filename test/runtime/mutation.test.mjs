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
const { PRACTICE_CHALLENGES } = loadTsExports(path.join(workspaceRoot, 'src', 'lib', 'practice-challenges.ts'));
const { normalizeQScript, qString } = loadTsExports(path.join(workspaceRoot, 'electron', 'q-script-utils.ts'));

const exampleInputs = {
  'hello-circle': {
    mouse: [180, 220],
    mouseButtons: { left: false, middle: false, right: false },
    scroll: [0, 0],
    key: '',
    keys: [],
  },
  'color-grid': {
    mouse: [0, 0],
    mouseButtons: { left: false, middle: false, right: false },
    scroll: [0, 0],
    key: '',
    keys: [],
  },
  'breathing-ring': {
    mouse: [0, 0],
    mouseButtons: { left: false, middle: false, right: false },
    scroll: [0, 0],
    key: '',
    keys: [],
  },
  'line-weave': {
    mouse: [0, 0],
    mouseButtons: { left: false, middle: false, right: false },
    scroll: [0, 0],
    key: '',
    keys: [],
  },
  'text-poster': {
    mouse: [0, 0],
    mouseButtons: { left: false, middle: false, right: false },
    scroll: [0, 0],
    key: '',
    keys: [],
  },
  'image-stamp': {
    mouse: [0, 0],
    mouseButtons: { left: false, middle: false, right: false },
    scroll: [0, 0],
    key: '',
    keys: [],
  },
  'particle-fountain': {
    mouse: [0, 0],
    mouseButtons: { left: false, middle: false, right: false },
    scroll: [0, 0],
    key: '',
    keys: [],
  },
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

const runtimeCases = [
  ...createBridgeCases(),
  ...createExampleCases(),
];

assert.equal(runtimeCases.length, 100, `expected 100 runtime mutation tests, found ${runtimeCases.length}`);

for (const { name, run } of runtimeCases) {
  test(name, run);
}

test('runtime parser keeps multiline table assignments intact for verification-style code', () => {
  const result = runBoot([
    ...normalizeQScript(`sales:([]
  city:\`London\`London\`Paris\`Paris\`Berlin\`Berlin;
  quarter:\`Q1\`Q2\`Q1\`Q2\`Q1\`Q2;
  revenue:120 140 90 110 80 70;
);
answer:sales;
.qv.emitjson["TRACE";flip answer];`),
  ]);

  assert.equal(result.status, 0, result.stderr);
  const trace = parseTaggedJson(result.stdoutLines, 'TRACE');
  assert.deepEqual(trace.city, ['London', 'London', 'Paris', 'Paris', 'Berlin', 'Berlin']);
  assert.deepEqual(trace.quarter, ['Q1', 'Q2', 'Q1', 'Q2', 'Q1', 'Q2']);
  assert.deepEqual(trace.revenue, [120, 140, 90, 110, 80, 70]);
});

test('practice verification normalizes keyed table answers before comparison', () => {
  const challenge = PRACTICE_CHALLENGES.find((entry) => entry.id === 'city-revenue-rollup');
  assert.ok(challenge, 'missing city revenue rollup challenge');

  const result = runBoot([
    ...normalizeQScript(`sales:([]
  city:\`London\`London\`Paris\`Paris\`Berlin\`Berlin;
  quarter:\`Q1\`Q2\`Q1\`Q2\`Q1\`Q2;
  revenue:120 140 90 110 80 70;
);
answer:select totalRevenue:sum revenue by city from sales where city in \`London\`Paris;
.qv.emitjson["TRACE"; value parse ${qString(challenge.answerExpression)}];`),
  ]);

  assert.equal(result.status, 0, result.stderr);
  const trace = parseTaggedJson(result.stdoutLines, 'TRACE');
  assert.deepEqual(trace, {
    city: ['London', 'Paris'],
    totalRevenue: [260, 200],
  });
});

test('practice verification hot-days answer produces expected filtered rows', () => {
  const challenge = PRACTICE_CHALLENGES.find((entry) => entry.id === 'hot-days');
  assert.ok(challenge, 'missing hot-days challenge');

  const result = runBoot([
    ...normalizeQScript(`weather:([]
  day:\`Mon\`Tue\`Wed\`Thu\`Fri\`Sat\`Sun;
  tempC:18 22 20 27 25 31 16
);
answer:\`tempC xdesc select day, tempC from weather where tempC > 24;
.qv.emitjson["TRACE"; value parse ${qString(challenge.answerExpression)}];`),
  ]);

  assert.equal(result.status, 0, result.stderr);
  const trace = parseTaggedJson(result.stdoutLines, 'TRACE');
  assert.deepEqual(trace, {
    day: ['Sat', 'Thu', 'Fri'],
    tempC: [31, 27, 25],
  });
});

test('practice verification monthly-lift answer produces expected top-lift rows', () => {
  const challenge = PRACTICE_CHALLENGES.find((entry) => entry.id === 'monthly-lift');
  assert.ok(challenge, 'missing monthly-lift challenge');

  const result = runBoot([
    ...normalizeQScript(`traffic:([]
  month:\`Jan\`Feb\`Mar\`Apr\`May\`Jun;
  visits:108 124 119 147 141 162
);
tmp:([] month:1_ traffic\`month; lift:1_ deltas traffic\`visits);
answer:2 # \`lift xdesc select from tmp where lift > 0;
.qv.emitjson["TRACE"; value parse ${qString(challenge.answerExpression)}];`),
  ]);

  assert.equal(result.status, 0, result.stderr);
  const trace = parseTaggedJson(result.stdoutLines, 'TRACE');
  assert.deepEqual(trace, {
    month: ['Apr', 'Jun'],
    lift: [28, 21],
  });
});

test('practice verification dept-max-salary answer produces expected salary table', () => {
  const challenge = PRACTICE_CHALLENGES.find((entry) => entry.id === 'dept-max-salary');
  assert.ok(challenge, 'missing dept-max-salary challenge');

  const result = runBoot([
    ...normalizeQScript(`staff:([]
  name:\`Alice\`Bob\`Carlos\`Diana\`Eve;
  dept:\`Eng\`Mktg\`Eng\`Ops\`Mktg;
  salary:95000 67000 112000 78000 71000
);
answer:\`maxSalary xdesc select maxSalary:max salary by dept from staff;
.qv.emitjson["TRACE"; value parse ${qString(challenge.answerExpression)}];`),
  ]);

  assert.equal(result.status, 0, result.stderr);
  const trace = parseTaggedJson(result.stdoutLines, 'TRACE');
  assert.deepEqual(trace, {
    dept: ['Eng', 'Ops', 'Mktg'],
    maxSalary: [112000, 78000, 71000],
  });
});

test('practice verification goal-difference answer produces expected standings', () => {
  const challenge = PRACTICE_CHALLENGES.find((entry) => entry.id === 'goal-difference');
  assert.ok(challenge, 'missing goal-difference challenge');

  const result = runBoot([
    ...normalizeQScript(`matches:([]
  team:\`Arsenal\`Arsenal\`Chelsea\`Chelsea\`Spurs\`Spurs;
  scored:2 3 1 4 0 2;
  conceded:1 0 3 1 2 1
);
answer:\`goalDiff xdesc select goalDiff:sum scored-conceded by team from matches;
.qv.emitjson["TRACE"; value parse ${qString(challenge.answerExpression)}];`),
  ]);

  assert.equal(result.status, 0, result.stderr);
  const trace = parseTaggedJson(result.stdoutLines, 'TRACE');
  assert.deepEqual(trace, {
    team: ['Arsenal', 'Chelsea', 'Spurs'],
    goalDiff: [4, 1, -1],
  });
});

function createBridgeCases() {
  const scalarCases = [
    {
      name: 'runtime bridge background stores the background kind',
      script: 'background[0x112233];',
      verify: (commands) => assert.equal(commands[0].kind, 'background'),
    },
    {
      name: 'runtime bridge background stores the background fill',
      script: 'background[0x112233];',
      verify: (commands) => assert.deepEqual(commands[0].fill, ['11', '22', '33']),
    },
    {
      name: 'runtime bridge circle stores the circle kind',
      script: 'circle enlist[`p`r!((1 2);3)];',
      verify: (commands) => assert.equal(commands[0].kind, 'circle'),
    },
    {
      name: 'runtime bridge rect stores the rect kind',
      script: 'rect enlist[`p`s!((1 2);(3 4))];',
      verify: (commands) => assert.equal(commands[0].kind, 'rect'),
    },
    {
      name: 'runtime bridge line stores the line kind',
      script: 'line enlist[`p`p2!((1 2);(3 4))];',
      verify: (commands) => assert.equal(commands[0].kind, 'line'),
    },
    {
      name: 'runtime bridge text stores the text kind',
      script: 'text enlist[`p`text!((1 2);"hi")];',
      verify: (commands) => assert.equal(commands[0].kind, 'text'),
    },
    {
      name: 'runtime bridge image stores the image kind',
      script: 'image enlist[`src`p!("asset";(1 2))];',
      verify: (commands) => assert.equal(commands[0].kind, 'image'),
    },
    {
      name: 'runtime bridge generic preserves nested list length',
      script: 'generic ((`kind`x`y!(`translate;1;2));(`kind`x`y!(`scale;3;4)));',
      verify: (commands) => assert.equal(commands.length, 2),
    },
    {
      name: 'runtime bridge push emits the push kind',
      script: 'push[];',
      verify: (commands) => assert.equal(commands[0].kind, 'push'),
    },
    {
      name: 'runtime bridge pop emits the pop kind',
      script: 'pop[];',
      verify: (commands) => assert.equal(commands[0].kind, 'pop'),
    },
    {
      name: 'runtime bridge translate stores x',
      script: 'translate 10 20;',
      verify: (commands) => assert.equal(commands[0].x, 10),
    },
    {
      name: 'runtime bridge translate stores y',
      script: 'translate 10 20;',
      verify: (commands) => assert.equal(commands[0].y, 20),
    },
    {
      name: 'runtime bridge scale copies a scalar x value',
      script: 'scale enlist 3;',
      verify: (commands) => assert.equal(commands[0].x, 3),
    },
    {
      name: 'runtime bridge scale copies a scalar y value',
      script: 'scale enlist 3;',
      verify: (commands) => assert.equal(commands[0].y, 3),
    },
    {
      name: 'runtime bridge scale preserves explicit y values',
      script: 'scale 3 5;',
      verify: (commands) => assert.equal(commands[0].y, 5),
    },
    {
      name: 'runtime bridge cursor stores the cursor name',
      script: 'cursor "crosshair";',
      verify: (commands) => assert.equal(commands[0].cursor, 'crosshair'),
    },
    {
      name: 'runtime bridge append preserves command order',
      script: 'background[0x112233]; translate 3 4;',
      verify: (commands) => assert.deepEqual(commands.map((command) => command.kind), ['background', 'translate']),
    },
    {
      name: 'runtime bridge emit writes the expected prefix',
      raw: true,
      script: '.qv.emit["TRACE";"payload"];',
      verifyLines: (stdoutLines) => assert.ok(stdoutLines.includes('__QANVAS_TRACE__payload')),
    },
    {
      name: 'runtime bridge emitjson serializes q data as JSON',
      raw: true,
      script: '.qv.emitjson["TRACE"; enlist[`kind`fill!(`background;0x112233)]];',
      verifyLines: (stdoutLines) => {
        const line = stdoutLines.find((entry) => entry.startsWith('__QANVAS_TRACE__'));
        assert.ok(line);
        const payload = JSON.parse(line.slice('__QANVAS_TRACE__'.length));
        assert.equal(payload[0].kind, 'background');
      },
    },
    {
      name: 'runtime bridge errmsg preserves string errors',
      raw: true,
      script: '.qv.emitjson["TRACE"; .qv.errmsg "boom"];',
      verifyLines: (stdoutLines) => {
        const line = stdoutLines.find((entry) => entry.startsWith('__QANVAS_TRACE__'));
        assert.equal(JSON.parse(line.slice('__QANVAS_TRACE__'.length)), 'boom');
      },
    },
  ];

  const initCases = [
    {
      name: 'runtime bridge init returns setup state',
      script: 'setup:{`bg`size!(0xabcdef;800 600)}; draw:{[state;frameInfo;input;canvas] state}; .qv.init[];',
      verify: (payload) => assert.equal(payload.bg, 0xabcdef),
    },
    {
      name: 'runtime bridge init keeps setup size',
      script: 'setup:{`bg`size!(0xabcdef;800 600)}; draw:{[state;frameInfo;input;canvas] state}; .qv.init[];',
      verify: (payload) => assert.deepEqual(payload.size, [800, 600]),
    },
    {
      name: 'runtime bridge init emits an INIT payload',
      script: 'setup:{`bg`size!(0xabcdef;800 600)}; draw:{[state;frameInfo;input;canvas] state}; .qv.init[];',
      verifyInitLine: (init) => assert.equal(init.bg, 0xabcdef),
    },
    {
      name: 'runtime bridge frame forwards frame numbers',
      script:
        'setup:{`lastFrame!enlist -1}; draw:{[state;frameInfo;input;canvas] `lastFrame!(frameInfo`frameNum)}; .qv.init[]; .qv.frame["{\\"frameNum\\":7,\\"time\\":0,\\"dt\\":16}";"{\\"mouse\\":[0,0],\\"mouseButtons\\":{\\"left\\":false,\\"middle\\":false,\\"right\\":false},\\"scroll\\":[0,0],\\"key\\":\\"\\",\\"keys\\":[]}";"{\\"size\\":[640,480],\\"pixelRatio\\":2}"]; .qv.emitjson["TRACE"; .qv.state];',
      verifyTrace: (trace) => assert.equal(trace.lastFrame, 7),
    },
    {
      name: 'runtime bridge frame forwards mouse positions',
      script:
        'setup:{`mouse!enlist 0 0}; draw:{[state;frameInfo;input;canvas] `mouse!enlist input`mouse}; .qv.init[]; .qv.frame["{\\"frameNum\\":0,\\"time\\":0,\\"dt\\":16}";"{\\"mouse\\":[12,34],\\"mouseButtons\\":{\\"left\\":false,\\"middle\\":false,\\"right\\":false},\\"scroll\\":[0,0],\\"key\\":\\"\\",\\"keys\\":[]}";"{\\"size\\":[640,480],\\"pixelRatio\\":2}"]; .qv.emitjson["TRACE"; .qv.state];',
      verifyTrace: (trace) => assert.deepEqual(trace.mouse, [12, 34]),
    },
    {
      name: 'runtime bridge frame forwards canvas size',
      script:
        'setup:{`canvas!enlist 0 0}; draw:{[state;frameInfo;input;canvas] `canvas!enlist canvas`size}; .qv.init[]; .qv.frame["{\\"frameNum\\":0,\\"time\\":0,\\"dt\\":16}";"{\\"mouse\\":[0,0],\\"mouseButtons\\":{\\"left\\":false,\\"middle\\":false,\\"right\\":false},\\"scroll\\":[0,0],\\"key\\":\\"\\",\\"keys\\":[]}";"{\\"size\\":[321,654],\\"pixelRatio\\":2}"]; .qv.emitjson["TRACE"; .qv.state];',
      verifyTrace: (trace) => assert.deepEqual(trace.canvas, [321, 654]),
    },
    {
      name: 'runtime bridge frame forwards pixel ratio',
      script:
        'setup:{`ratio!enlist 0}; draw:{[state;frameInfo;input;canvas] `ratio!enlist canvas`pixelRatio}; .qv.init[]; .qv.frame["{\\"frameNum\\":0,\\"time\\":0,\\"dt\\":16}";"{\\"mouse\\":[0,0],\\"mouseButtons\\":{\\"left\\":false,\\"middle\\":false,\\"right\\":false},\\"scroll\\":[0,0],\\"key\\":\\"\\",\\"keys\\":[]}";"{\\"size\\":[321,654],\\"pixelRatio\\":3}"]; .qv.emitjson["TRACE"; .qv.state];',
      verifyTrace: (trace) => assert.equal(trace.ratio, 3),
    },
    {
      name: 'runtime bridge frame updates state from draw',
      script:
        'setup:{`ticks!enlist 0}; draw:{[state;frameInfo;input;canvas] `ticks!(1+state`ticks)}; .qv.init[]; .qv.frame["{\\"frameNum\\":1,\\"time\\":0,\\"dt\\":16}";"{\\"mouse\\":[0,0],\\"mouseButtons\\":{\\"left\\":false,\\"middle\\":false,\\"right\\":false},\\"scroll\\":[0,0],\\"key\\":\\"\\",\\"keys\\":[]}";"{\\"size\\":[320,180],\\"pixelRatio\\":1}"]; .qv.emitjson["TRACE"; .qv.state];',
      verifyTrace: (trace) => assert.equal(trace.ticks, 1),
    },
    {
      name: 'runtime bridge frame emits only the commands created during draw',
      script:
        'setup:{background[0x010203]; enlist[`boot]!enlist 1}; draw:{[state;frameInfo;input;canvas] background[0x112233]; state}; .qv.init[]; .qv.frame["{\\"frameNum\\":0,\\"time\\":0,\\"dt\\":16}";"{\\"mouse\\":[0,0],\\"mouseButtons\\":{\\"left\\":false,\\"middle\\":false,\\"right\\":false},\\"scroll\\":[0,0],\\"key\\":\\"\\",\\"keys\\":[]}";"{\\"size\\":[320,180],\\"pixelRatio\\":1}"];',
      verifyFrame: (frame) => assert.deepEqual(frame.map((command) => command.kind), ['background']),
    },
    {
      name: 'runtime bridge frame preserves command payloads',
      script:
        'setup:{enlist[`boot]!enlist 1}; draw:{[state;frameInfo;input;canvas] circle enlist[`p`r!((7 8);9)]; state}; .qv.init[]; .qv.frame["{\\"frameNum\\":0,\\"time\\":0,\\"dt\\":16}";"{\\"mouse\\":[0,0],\\"mouseButtons\\":{\\"left\\":false,\\"middle\\":false,\\"right\\":false},\\"scroll\\":[0,0],\\"key\\":\\"\\",\\"keys\\":[]}";"{\\"size\\":[320,180],\\"pixelRatio\\":1}"];',
      verifyFrame: (frame) => {
        assert.equal(frame[0].kind, 'circle');
        assert.deepEqual(frame[0].data[0].p, [7, 8]);
      },
    },
  ];

  const cases = [];
  for (const item of scalarCases) {
    if (item.raw) {
      cases.push({
        name: item.name,
        run() {
          const result = runBoot([item.script]);
          assert.equal(result.status, 0);
          item.verifyLines(result.stdoutLines);
        },
      });
      continue;
    }

    cases.push({
      name: item.name,
      run() {
        const commands = runCommandScript(item.script);
        item.verify(commands);
      },
    });
  }

  for (const item of initCases) {
    cases.push({
      name: item.name,
      run() {
        const result = runBoot([item.script]);
        assert.equal(result.status, 0, result.stderr);
        const init = parseTaggedJson(result.stdoutLines, 'INIT');
        const frame = item.verifyFrame ? parseTaggedJson(result.stdoutLines, 'FRAME') : null;
        const trace = item.verifyTrace ? parseTaggedJson(result.stdoutLines, 'TRACE') : null;
        if (item.verify) item.verify(init);
        if (item.verifyInitLine) item.verifyInitLine(init);
        if (item.verifyFrame) item.verifyFrame(frame);
        if (item.verifyTrace) item.verifyTrace(trace);
      },
    });
  }

  const selectedCases = [cases[0], cases[1], cases[2], cases[6], cases[10], cases[14], cases[16], cases[17], cases[18], cases[29]];
  assert.equal(selectedCases.length, 10, `expected 10 bridge tests, found ${selectedCases.length}`);
  return selectedCases;
}

function createExampleCases() {
  const perExampleChecks = [
    {
      suffix: 'exits cleanly',
      run(example, result) {
        assert.equal(result.status, 0, `q exited with status ${result.status}`);
      },
    },
    {
      suffix: 'writes no stderr',
      run(example, result) {
        assert.equal(result.stderr.trim(), '', `stderr for ${example.id}: ${result.stderr}`);
      },
    },
    {
      suffix: 'emits an init payload',
      run(example, result) {
        assert.ok(findTaggedJson(result.stdoutLines, 'INIT'), `missing init payload for ${example.id}`);
      },
    },
    {
      suffix: 'emits a frame payload',
      run(example, result) {
        assert.ok(findTaggedJson(result.stdoutLines, 'FRAME'), `missing frame payload for ${example.id}`);
      },
    },
    {
      suffix: 'produces a non-empty command list',
      run(example, result) {
        const frame = parseTaggedJson(result.stdoutLines, 'FRAME');
        assert.ok(frame.length > 0, `missing commands for ${example.id}`);
      },
    },
    {
      suffix: 'starts each frame with a background command',
      run(example, result) {
        const frame = parseTaggedJson(result.stdoutLines, 'FRAME');
        assert.equal(frame[0].kind, 'background');
      },
    },
    {
      suffix: 'matches the expected command kinds',
      run(example, result) {
        const frame = parseTaggedJson(result.stdoutLines, 'FRAME');
        assert.deepEqual(frame.map((command) => command.kind), expectedKinds[example.id]);
      },
    },
    {
      suffix: 'keeps each command kind as a string',
      run(example, result) {
        const frame = parseTaggedJson(result.stdoutLines, 'FRAME');
        assert.equal(frame.every((command) => typeof command.kind === 'string'), true);
      },
    },
    {
      suffix: 'emits an object-like init state',
      run(example, result) {
        const init = parseTaggedJson(result.stdoutLines, 'INIT');
        assert.equal(typeof init, 'object');
      },
    },
    {
      suffix: 'keeps stdout free of uncaught q errors',
      run(example, result) {
        assert.equal(result.stdoutLines.some((line) => /'/.test(line) && !line.startsWith('__QANVAS_')), false);
      },
    },
  ];

  const cases = [];
  for (const example of EXAMPLES) {
    for (const check of perExampleChecks) {
      cases.push({
        name: `runtime example ${example.id} ${check.suffix}`,
        run() {
          const result = runSketch(example.code, {
            frameInfo: { frameNum: 0, time: 0, dt: 16 },
            input: exampleInputs[example.id],
            canvas: { size: [650, 632], pixelRatio: 1 },
          });
          check.run(example, result);
        },
      });
    }
  }

  assert.equal(cases.length, 90, `expected 90 example tests, found ${cases.length}`);
  return cases;
}

function runCommandScript(script) {
  const result = runBoot([
    '.qv.cmds:enlist[::];',
    script,
    '.qv.emitjson["TRACE";1_ .qv.cmds];',
  ]);
  assert.equal(result.status, 0, result.stderr);
  return parseTaggedJson(result.stdoutLines, 'TRACE');
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
    stdoutLines: normalizeStdout(result.stdout),
  };
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
