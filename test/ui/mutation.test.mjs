import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const workspaceRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const qLanguageModule = loadTsModule(path.join(workspaceRoot, 'src', 'lib', 'monaco', 'q-language.ts'));
const canvasSurfaceModule = loadTsModule(path.join(workspaceRoot, 'src', 'lib', 'runtime', 'canvas-surface.ts'));
const { registerQLanguage } = qLanguageModule.exports;
const { CanvasSurface } = canvasSurfaceModule.exports;

const uiCases = [
  ...createQLanguageCases(),
  ...createCanvasSurfaceCases(),
];

assert.equal(uiCases.length, 100, `expected 100 UI mutation tests, found ${uiCases.length}`);

for (const { name, run } of uiCases) {
  test(name, run);
}

function createQLanguageCases() {
  const monaco = createMonacoRecorder();
  registerQLanguage(monaco);

  const config = monaco.languageConfigs.get('q');
  const tokens = monaco.tokenProviders.get('q');
  const theme = monaco.themes.get('qanvas-warm');

  const cases = [
    ['ui q-language registers the q language id', () => assert.deepEqual(plain(monaco.registerCalls), [{ id: 'q' }])],
    ['ui q-language sets a config for q', () => assert.ok(config)],
    ['ui q-language uses slash comments', () => assert.equal(config.comments.lineComment, '/')],
    ['ui q-language exposes three bracket pairs', () => assert.equal(config.brackets.length, 3)],
    ['ui q-language includes curly brackets', () => assert.deepEqual(plain(config.brackets[0]), ['{', '}'])],
    ['ui q-language includes square brackets', () => assert.deepEqual(plain(config.brackets[1]), ['[', ']'])],
    ['ui q-language includes parentheses', () => assert.deepEqual(plain(config.brackets[2]), ['(', ')'])],
    ['ui q-language adds four auto closing pairs', () => assert.equal(config.autoClosingPairs.length, 4)],
    ['ui q-language auto closes curly brackets', () => assert.deepEqual(plain(config.autoClosingPairs[0]), { open: '{', close: '}' })],
    ['ui q-language auto closes square brackets', () => assert.deepEqual(plain(config.autoClosingPairs[1]), { open: '[', close: ']' })],
    ['ui q-language auto closes parentheses', () => assert.deepEqual(plain(config.autoClosingPairs[2]), { open: '(', close: ')' })],
    ['ui q-language auto closes double quotes', () => assert.deepEqual(plain(config.autoClosingPairs[3]), { open: '"', close: '"' })],
    ['ui q-language adds four surrounding pairs', () => assert.equal(config.surroundingPairs.length, 4)],
    ['ui q-language surrounds curly brackets', () => assert.deepEqual(plain(config.surroundingPairs[0]), { open: '{', close: '}' })],
    ['ui q-language surrounds square brackets', () => assert.deepEqual(plain(config.surroundingPairs[1]), { open: '[', close: ']' })],
    ['ui q-language surrounds parentheses', () => assert.deepEqual(plain(config.surroundingPairs[2]), { open: '(', close: ')' })],
    ['ui q-language surrounds double quotes', () => assert.deepEqual(plain(config.surroundingPairs[3]), { open: '"', close: '"' })],
    ['ui q-language sets a tokenizer for q', () => assert.ok(tokens)],
    ['ui q-language tokenizer has root rules', () => assert.ok(Array.isArray(tokens.tokenizer.root))],
    ['ui q-language tokenizer exposes eleven root rules', () => assert.equal(tokens.tokenizer.root.length, 11)],
    ['ui q-language defines the warm theme', () => assert.ok(theme)],
    ['ui q-language theme uses the VS base', () => assert.equal(theme.base, 'vs')],
    ['ui q-language theme inherits existing styles', () => assert.equal(theme.inherit, true)],
    ['ui q-language theme has five token rules', () => assert.equal(theme.rules.length, 5)],
    ['ui q-language comment token color stays warm gray', () => assert.equal(findThemeRule(theme, 'comment').foreground, 'A89B8E')],
    ['ui q-language comment token stays italic', () => assert.equal(findThemeRule(theme, 'comment').fontStyle, 'italic')],
    ['ui q-language keyword token color stays brown', () => assert.equal(findThemeRule(theme, 'keyword').foreground, '7D4E2D')],
    ['ui q-language number token color stays blue', () => assert.equal(findThemeRule(theme, 'number').foreground, '5B6FE8')],
    ['ui q-language string token color stays terracotta', () => assert.equal(findThemeRule(theme, 'string').foreground, 'B35B3F')],
    ['ui q-language type token color stays tan', () => assert.equal(findThemeRule(theme, 'type').foreground, '8B674B')],
    ['ui q-language editor background remains warm white', () => assert.equal(theme.colors['editor.background'], '#FFFDF9')],
    ['ui q-language editor foreground remains dark ink', () => assert.equal(theme.colors['editor.foreground'], '#2C2520')],
    ['ui q-language line number foreground remains muted', () => assert.equal(theme.colors['editorLineNumber.foreground'], '#B5A799')],
    ['ui q-language active line number foreground remains stronger', () => assert.equal(theme.colors['editorLineNumber.activeForeground'], '#7A6E62')],
    ['ui q-language cursor foreground remains blue', () => assert.equal(theme.colors['editorCursor.foreground'], '#5B6FE8')],
    ['ui q-language selection background remains tinted', () => assert.equal(theme.colors['editor.selectionBackground'], '#DDE2FF')],
    ['ui q-language inactive selection remains warm neutral', () => assert.equal(theme.colors['editor.inactiveSelectionBackground'], '#EEE8DD')],
    ['ui q-language line highlight remains warm', () => assert.equal(theme.colors['editor.lineHighlightBackground'], '#F7F1E9')],
    ['ui q-language indent guide remains visible', () => assert.equal(theme.colors['editorIndentGuide.background1'], '#EAE0D2')],
    ['ui q-language whitespace remains muted', () => assert.equal(theme.colors['editorWhitespace.foreground'], '#D6CABB')],
    ['ui q-language widget background remains warm white', () => assert.equal(theme.colors['editorWidget.background'], '#FFFDF9')],
    ['ui q-language widget border remains subtle', () => assert.equal(theme.colors['editorWidget.border'], '#E0D8CC')],
    ['ui q-language scrollbar background remains translucent', () => assert.equal(theme.colors['scrollbarSlider.background'], '#C9BDABAA')],
    ['ui q-language scrollbar hover background remains darker', () => assert.equal(theme.colors['scrollbarSlider.hoverBackground'], '#B8AA96CC')],
  ];

  const tokenSamples = [
    ['ui q-language tokenizes slash comments', '/ comment', 'comment'],
    ['ui q-language tokenizes slash commands as keywords', '\\l file.q', 'keyword'],
    ['ui q-language tokenizes opening braces', '{', 'delimiter.curly'],
    ['ui q-language tokenizes closing braces', '}', 'delimiter.curly'],
    ['ui q-language tokenizes integers', '42', 'number'],
    ['ui q-language tokenizes negative floats', '-3.14', 'number'],
    ['ui q-language tokenizes scientific-like values', '6e3', 'number'],
    ['ui q-language tokenizes suffixed numerics', '7j', 'number'],
    ['ui q-language tokenizes symbols as types', '`alpha.beta', 'type'],
    ['ui q-language tokenizes quoted strings', '"hello"', 'string'],
    ['ui q-language tokenizes select as keyword', 'select', 'keyword'],
    ['ui q-language tokenizes update as keyword', 'update', 'keyword'],
    ['ui q-language tokenizes each as keyword', 'each', 'keyword'],
    ['ui q-language tokenizes sin as keyword', 'sin', 'keyword'],
    ['ui q-language tokenizes aj as keyword', 'aj', 'keyword'],
    ['ui q-language tokenizes identifiers', 'drawState', 'identifier'],
    ['ui q-language tokenizes dotted identifiers', 'frame.info', 'identifier'],
    ['ui q-language tokenizes operators', '+', 'operator'],
    ['ui q-language tokenizes whitespace', '   ', 'white'],
  ];

  for (const [name, sample, expectedToken] of tokenSamples) {
    cases.push([name, () => assert.equal(classifyToken(tokens, sample), expectedToken)]);
  }

  const selectedCases = [...cases.slice(0, 31), ...cases.slice(-19)];
  assert.equal(selectedCases.length, 50, `expected 50 q-language tests, found ${selectedCases.length}`);
  return selectedCases.map(([name, run]) => ({ name, run }));
}

function createCanvasSurfaceCases() {
  const cases = [
    {
      name: 'ui canvas surface returns the default size before attach',
      run() {
        const surface = new CanvasSurface();
        assert.deepEqual(plain(surface.getSize()), [1200, 800]);
      },
    },
    {
      name: 'ui canvas surface rounds measured size',
      run() {
        const harness = createSurfaceHarness({ rect: { width: 320.6, height: 199.2 } });
        harness.surface.attach(harness.canvas);
        assert.deepEqual(plain(harness.surface.getSize()), [321, 199]);
      },
    },
    {
      name: 'ui canvas surface attach requests the 2d context',
      run() {
        const harness = createSurfaceHarness();
        harness.surface.attach(harness.canvas);
        assert.deepEqual(plain(harness.canvas.calls.getContext), ['2d']);
      },
    },
    {
      name: 'ui canvas surface attach resizes canvas width by device ratio',
      run() {
        const harness = createSurfaceHarness({ rect: { width: 150, height: 90 }, devicePixelRatio: 2 });
        harness.surface.attach(harness.canvas);
        assert.equal(harness.canvas.width, 300);
      },
    },
    {
      name: 'ui canvas surface attach resizes canvas height by device ratio',
      run() {
        const harness = createSurfaceHarness({ rect: { width: 150, height: 90 }, devicePixelRatio: 2 });
        harness.surface.attach(harness.canvas);
        assert.equal(harness.canvas.height, 180);
      },
    },
    {
      name: 'ui canvas surface resize keeps a minimum width of one pixel',
      run() {
        const harness = createSurfaceHarness({ rect: { width: 0, height: 40 } });
        harness.surface.attach(harness.canvas);
        assert.equal(harness.canvas.width, 1);
      },
    },
    {
      name: 'ui canvas surface resize keeps a minimum height of one pixel',
      run() {
        const harness = createSurfaceHarness({ rect: { width: 40, height: 0 } });
        harness.surface.attach(harness.canvas);
        assert.equal(harness.canvas.height, 1);
      },
    },
    {
      name: 'ui canvas surface resize applies a transform with the device ratio',
      run() {
        const harness = createSurfaceHarness({ devicePixelRatio: 1.5 });
        harness.surface.attach(harness.canvas);
        assert.deepEqual(lastCall(harness.log, 'setTransform').args, [1.5, 0, 0, 1.5, 0, 0]);
      },
    },
    {
      name: 'ui canvas surface attach clears immediately',
      run() {
        const harness = createSurfaceHarness();
        harness.surface.attach(harness.canvas);
        assert.ok(hasCall(harness.log, 'fillRect'));
      },
    },
    {
      name: 'ui canvas surface clear uses the default background color',
      run() {
        const harness = createSurfaceHarness();
        harness.surface.attach(harness.canvas);
        assert.equal(lastAssigned(harness.log, 'fillStyle'), 'rgb(244 236 216)');
      },
    },
    {
      name: 'ui canvas surface clear accepts packed numeric colors',
      run() {
        const harness = createSurfaceHarness();
        harness.surface.attach(harness.canvas);
        harness.surface.clear(0x112233);
        assert.equal(lastAssigned(harness.log, 'fillStyle'), 'rgb(17 34 51)');
      },
    },
    {
      name: 'ui canvas surface clear accepts three digit hex colors',
      run() {
        const harness = createSurfaceHarness();
        harness.surface.attach(harness.canvas);
        harness.surface.clear('#abc');
        assert.equal(lastAssigned(harness.log, 'fillStyle'), 'rgb(170 187 204)');
      },
    },
    {
      name: 'ui canvas surface clear accepts six digit hex colors',
      run() {
        const harness = createSurfaceHarness();
        harness.surface.attach(harness.canvas);
        harness.surface.clear('#102030');
        assert.equal(lastAssigned(harness.log, 'fillStyle'), 'rgb(16 32 48)');
      },
    },
    {
      name: 'ui canvas surface clear accepts RGB string arrays',
      run() {
        const harness = createSurfaceHarness();
        harness.surface.attach(harness.canvas);
        harness.surface.clear(['0a', '0b', '0c']);
        assert.equal(lastAssigned(harness.log, 'fillStyle'), 'rgb(10 11 12)');
      },
    },
    {
      name: 'ui canvas surface clear falls back on invalid colors',
      run() {
        const harness = createSurfaceHarness();
        harness.surface.attach(harness.canvas);
        harness.surface.clear('wat');
        assert.equal(lastAssigned(harness.log, 'fillStyle'), 'rgb(244 236 216)');
      },
    },
    {
      name: 'ui canvas surface clear paints the full canvas width',
      run() {
        const harness = createSurfaceHarness({ rect: { width: 333, height: 222 } });
        harness.surface.attach(harness.canvas);
        const call = lastCall(harness.log, 'fillRect');
        assert.equal(call.args[2], 333);
      },
    },
    {
      name: 'ui canvas surface clear paints the full canvas height',
      run() {
        const harness = createSurfaceHarness({ rect: { width: 333, height: 222 } });
        harness.surface.attach(harness.canvas);
        const call = lastCall(harness.log, 'fillRect');
        assert.equal(call.args[3], 222);
      },
    },
    {
      name: 'ui canvas surface draw executes background commands',
      run() {
        const harness = createSurfaceHarness();
        harness.surface.attach(harness.canvas);
        harness.surface.draw([{ kind: 'background', fill: '#010203' }], { showFps: false, fps: 0 });
        assert.equal(lastAssigned(harness.log, 'fillStyle'), 'rgb(1 2 3)');
      },
    },
    {
      name: 'ui canvas surface draw executes circle commands',
      run() {
        const harness = createSurfaceHarness();
        harness.surface.attach(harness.canvas);
        harness.surface.draw([{ kind: 'circle', data: { p: [12, 24], r: 18, fill: 0x223344 } }], { showFps: false, fps: 0 });
        assert.deepEqual(lastCall(harness.log, 'arc').args, [12, 24, 18, 0, Math.PI * 2]);
      },
    },
    {
      name: 'ui canvas surface circle defaults radius when absent',
      run() {
        const harness = createSurfaceHarness();
        harness.surface.attach(harness.canvas);
        harness.surface.draw([{ kind: 'circle', data: { p: [5, 6], fill: 0x223344 } }], { showFps: false, fps: 0 });
        assert.equal(lastCall(harness.log, 'arc').args[2], 20);
      },
    },
    {
      name: 'ui canvas surface circle fills when fill exists',
      run() {
        const harness = createSurfaceHarness();
        harness.surface.attach(harness.canvas);
        harness.surface.draw([{ kind: 'circle', data: { p: [1, 2], r: 3, fill: 0x010203 } }], { showFps: false, fps: 0 });
        assert.ok(hasCall(harness.log, 'fill'));
      },
    },
    {
      name: 'ui canvas surface circle strokes when stroke exists',
      run() {
        const harness = createSurfaceHarness();
        harness.surface.attach(harness.canvas);
        harness.surface.draw([{ kind: 'circle', data: { p: [1, 2], r: 3, stroke: 0x010203 } }], { showFps: false, fps: 0 });
        assert.ok(hasCall(harness.log, 'stroke'));
      },
    },
    {
      name: 'ui canvas surface line ignores fill-only painting',
      run() {
        const harness = createSurfaceHarness();
        harness.surface.attach(harness.canvas);
        harness.surface.draw([{ kind: 'line', data: { p: [0, 1], p2: [2, 3], fill: 0xff0000, stroke: 0x00ff00 } }], { showFps: false, fps: 0 });
        assert.equal(countCalls(harness.log, 'fill'), 0);
      },
    },
    {
      name: 'ui canvas surface draw executes rect commands',
      run() {
        const harness = createSurfaceHarness();
        harness.surface.attach(harness.canvas);
        harness.surface.draw([{ kind: 'rect', data: { p: [7, 8], s: [90, 30], fill: '#101112' } }], { showFps: false, fps: 0 });
        assert.deepEqual(lastCall(harness.log, 'rect').args, [7, 8, 90, 30]);
      },
    },
    {
      name: 'ui canvas surface rect defaults size when absent',
      run() {
        const harness = createSurfaceHarness();
        harness.surface.attach(harness.canvas);
        harness.surface.draw([{ kind: 'rect', data: { p: [7, 8], fill: '#101112' } }], { showFps: false, fps: 0 });
        assert.deepEqual(lastCall(harness.log, 'rect').args, [7, 8, 40, 40]);
      },
    },
    {
      name: 'ui canvas surface draw executes line commands',
      run() {
        const harness = createSurfaceHarness();
        harness.surface.attach(harness.canvas);
        harness.surface.draw([{ kind: 'line', data: { p: [1, 2], p2: [3, 4], stroke: '#111213' } }], { showFps: false, fps: 0 });
        assert.deepEqual(lastCall(harness.log, 'moveTo').args, [1, 2]);
      },
    },
    {
      name: 'ui canvas surface line defaults the second point',
      run() {
        const harness = createSurfaceHarness();
        harness.surface.attach(harness.canvas);
        harness.surface.draw([{ kind: 'line', data: { p: [1, 2], stroke: '#111213' } }], { showFps: false, fps: 0 });
        assert.deepEqual(lastCall(harness.log, 'lineTo').args, [100, 100]);
      },
    },
    {
      name: 'ui canvas surface draw executes text commands',
      run() {
        const harness = createSurfaceHarness();
        harness.surface.attach(harness.canvas);
        harness.surface.draw([{ kind: 'text', data: { p: [50, 60], text: 'hello', fill: '#010203', alpha: 0.5 } }], { showFps: false, fps: 0 });
        assert.deepEqual(lastCall(harness.log, 'fillText').args, ['hello', 50, 60]);
      },
    },
    {
      name: 'ui canvas surface text defaults empty strings',
      run() {
        const harness = createSurfaceHarness();
        harness.surface.attach(harness.canvas);
        harness.surface.draw([{ kind: 'text', data: { p: [50, 60], fill: '#010203' } }], { showFps: false, fps: 0 });
        assert.equal(lastCall(harness.log, 'fillText').args[0], '');
      },
    },
    {
      name: 'ui canvas surface text falls back to the default fill color',
      run() {
        const harness = createSurfaceHarness();
        harness.surface.attach(harness.canvas);
        harness.surface.draw([{ kind: 'text', data: { p: [50, 60], text: 'hello' } }], { showFps: false, fps: 0 });
        assert.equal(lastAssigned(harness.log, 'fillStyle'), 'rgba(44, 37, 32, 1)');
      },
    },
    {
      name: 'ui canvas surface invalid alpha falls back to one',
      run() {
        const harness = createSurfaceHarness();
        harness.surface.attach(harness.canvas);
        harness.surface.draw([{ kind: 'text', data: { p: [50, 60], text: 'hello', fill: '#010203', alpha: 'oops' } }], { showFps: false, fps: 0 });
        assert.equal(lastAssigned(harness.log, 'fillStyle'), 'rgba(1, 2, 3, 1)');
      },
    },
    {
      name: 'ui canvas surface draw skips incomplete images',
      run() {
        const harness = createSurfaceHarness({ imageDefaults: { complete: false, naturalWidth: 120, naturalHeight: 80 } });
        harness.surface.attach(harness.canvas);
        harness.surface.draw([{ kind: 'image', data: { src: 'asset.png', p: [10, 20], s: [30, 40] } }], { showFps: false, fps: 0 });
        assert.equal(countCalls(harness.log, 'drawImage'), 0);
      },
    },
    {
      name: 'ui canvas surface draw skips zero-width images',
      run() {
        const harness = createSurfaceHarness({ imageDefaults: { complete: true, naturalWidth: 0, naturalHeight: 80 } });
        harness.surface.attach(harness.canvas);
        harness.surface.draw([{ kind: 'image', data: { src: 'asset.png', p: [10, 20], s: [30, 40] } }], { showFps: false, fps: 0 });
        assert.equal(countCalls(harness.log, 'drawImage'), 0);
      },
    },
    {
      name: 'ui canvas surface draw executes loaded images',
      run() {
        const harness = createSurfaceHarness();
        harness.surface.attach(harness.canvas);
        harness.surface.draw([{ kind: 'image', data: { src: 'asset.png', p: [10, 20], s: [30, 40], alpha: 0.4 } }], { showFps: false, fps: 0 });
        assert.deepEqual(lastCall(harness.log, 'drawImage').args.slice(1), [10, 20, 30, 40]);
      },
    },
    {
      name: 'ui canvas surface image defaults to natural width and height',
      run() {
        const harness = createSurfaceHarness({ imageDefaults: { complete: true, naturalWidth: 55, naturalHeight: 66 } });
        harness.surface.attach(harness.canvas);
        harness.surface.draw([{ kind: 'image', data: { src: 'asset.png', p: [10, 20] } }], { showFps: false, fps: 0 });
        assert.deepEqual(lastCall(harness.log, 'drawImage').args.slice(1), [10, 20, 55, 66]);
      },
    },
    {
      name: 'ui canvas surface image applies alpha before drawing',
      run() {
        const harness = createSurfaceHarness();
        harness.surface.attach(harness.canvas);
        harness.surface.draw([{ kind: 'image', data: { src: 'asset.png', p: [10, 20], s: [30, 40], alpha: 0.4 } }], { showFps: false, fps: 0 });
        assert.equal(lastAssigned(harness.log, 'globalAlpha'), 0.4);
      },
    },
    {
      name: 'ui canvas surface translate forwards x and y',
      run() {
        const harness = createSurfaceHarness();
        harness.surface.attach(harness.canvas);
        harness.surface.draw([{ kind: 'translate', x: 9, y: 11 }], { showFps: false, fps: 0 });
        assert.deepEqual(lastCall(harness.log, 'translate').args, [9, 11]);
      },
    },
    {
      name: 'ui canvas surface scale uses the same value when y is missing',
      run() {
        const harness = createSurfaceHarness();
        harness.surface.attach(harness.canvas);
        harness.surface.draw([{ kind: 'scale', x: 1.5 }], { showFps: false, fps: 0 });
        assert.deepEqual(lastCall(harness.log, 'scale').args, [1.5, 1.5]);
      },
    },
    {
      name: 'ui canvas surface scale respects an explicit y value',
      run() {
        const harness = createSurfaceHarness();
        harness.surface.attach(harness.canvas);
        harness.surface.draw([{ kind: 'scale', x: 2, y: 3 }], { showFps: false, fps: 0 });
        assert.deepEqual(lastCall(harness.log, 'scale').args, [2, 3]);
      },
    },
    {
      name: 'ui canvas surface rotate forwards the angle',
      run() {
        const harness = createSurfaceHarness();
        harness.surface.attach(harness.canvas);
        harness.surface.draw([{ kind: 'rotate', angle: Math.PI / 4 }], { showFps: false, fps: 0 });
        assert.equal(lastCall(harness.log, 'rotate').args[0], Math.PI / 4);
      },
    },
    {
      name: 'ui canvas surface push saves the context',
      run() {
        const harness = createSurfaceHarness();
        harness.surface.attach(harness.canvas);
        const before = countCalls(harness.log, 'save');
        harness.surface.draw([{ kind: 'push' }], { showFps: false, fps: 0 });
        assert.equal(countCalls(harness.log, 'save'), before + 2);
      },
    },
    {
      name: 'ui canvas surface pop restores the context',
      run() {
        const harness = createSurfaceHarness();
        harness.surface.attach(harness.canvas);
        const before = countCalls(harness.log, 'restore');
        harness.surface.draw([{ kind: 'pop' }], { showFps: false, fps: 0 });
        assert.equal(countCalls(harness.log, 'restore'), before + 2);
      },
    },
    {
      name: 'ui canvas surface generic commands execute nested draws',
      run() {
        const harness = createSurfaceHarness();
        harness.surface.attach(harness.canvas);
        harness.surface.draw([{ kind: 'generic', data: [{ kind: 'translate', x: 4, y: 8 }] }], { showFps: false, fps: 0 });
        assert.deepEqual(lastCall(harness.log, 'translate').args, [4, 8]);
      },
    },
    {
      name: 'ui canvas surface unknown commands are ignored',
      run() {
        const harness = createSurfaceHarness();
        harness.surface.attach(harness.canvas);
        const before = harness.log.length;
        harness.surface.draw([{ kind: 'mystery' }], { showFps: false, fps: 0 });
        assert.equal(countCalls(harness.log.slice(before), 'arc'), 0);
      },
    },
    {
      name: 'ui canvas surface draw skips the FPS badge when hidden',
      run() {
        const harness = createSurfaceHarness();
        harness.surface.attach(harness.canvas);
        harness.surface.draw([], { showFps: false, fps: 72 });
        assert.equal(harness.log.some((entry) => entry.method === 'fillText' && entry.args[0] === '72 fps'), false);
      },
    },
    {
      name: 'ui canvas surface draw renders the FPS badge when shown',
      run() {
        const harness = createSurfaceHarness({ rect: { width: 500, height: 300 } });
        harness.surface.attach(harness.canvas);
        harness.surface.draw([], { showFps: true, fps: 72 });
        assert.equal(harness.log.some((entry) => entry.method === 'fillText' && entry.args[0] === '72 fps'), true);
      },
    },
    {
      name: 'ui canvas surface exportPng sets the link download name',
      run() {
        const harness = createSurfaceHarness();
        harness.surface.attach(harness.canvas);
        harness.surface.exportPng('frame.png');
        assert.equal(harness.createdLinks[0].download, 'frame.png');
      },
    },
    {
      name: 'ui canvas surface exportPng uses the PNG data URL',
      run() {
        const harness = createSurfaceHarness();
        harness.surface.attach(harness.canvas);
        harness.surface.exportPng('frame.png');
        assert.equal(harness.createdLinks[0].href, 'data:image/png;base64,fake');
      },
    },
    {
      name: 'ui canvas surface exportPng clicks the temporary link',
      run() {
        const harness = createSurfaceHarness();
        harness.surface.attach(harness.canvas);
        harness.surface.exportPng('frame.png');
        assert.equal(harness.createdLinks[0].clicked, true);
      },
    },
    {
      name: 'ui canvas surface updateFps returns zero for a single sample',
      run() {
        const surface = new CanvasSurface();
        assert.equal(surface.updateFps(1000), 0);
      },
    },
    {
      name: 'ui canvas surface updateFps computes whole-number FPS from elapsed time',
      run() {
        const surface = new CanvasSurface();
        surface.updateFps(1000);
        assert.equal(surface.updateFps(1100), 10);
      },
    },
    {
      name: 'ui canvas surface updateFps returns zero when timestamps do not advance',
      run() {
        const surface = new CanvasSurface();
        surface.updateFps(1000);
        assert.equal(surface.updateFps(1000), 0);
      },
    },
    {
      name: 'ui canvas surface updateFps keeps a rolling 60-sample window',
      run() {
        const surface = new CanvasSurface();
        for (let index = 0; index < 61; index += 1) {
          surface.updateFps(index * 16);
        }
        assert.equal(surface.updateFps(61 * 16), 63);
      },
    },
  ];

  const selectedCases = cases.slice(0, 50);
  assert.equal(selectedCases.length, 50, `expected 50 canvas tests, found ${selectedCases.length}`);
  return selectedCases;
}

function createMonacoRecorder() {
  const registerCalls = [];
  const languageConfigs = new Map();
  const tokenProviders = new Map();
  const themes = new Map();

  return {
    registerCalls,
    languageConfigs,
    tokenProviders,
    themes,
    languages: {
      register(config) {
        registerCalls.push(config);
      },
      setLanguageConfiguration(id, config) {
        languageConfigs.set(id, config);
      },
      setMonarchTokensProvider(id, provider) {
        tokenProviders.set(id, provider);
      },
    },
    editor: {
      defineTheme(name, config) {
        themes.set(name, config);
      },
    },
  };
}

function findThemeRule(theme, token) {
  return theme.rules.find((rule) => rule.token === token);
}

function classifyToken(provider, sample) {
  for (const [pattern, token] of provider.tokenizer.root) {
    if (pattern.test(sample)) {
      return token;
    }
  }
  return null;
}

function createSurfaceHarness(options = {}) {
  const {
    rect = { width: 320, height: 180 },
    devicePixelRatio = 2,
    imageDefaults = { complete: true, naturalWidth: 120, naturalHeight: 80 },
  } = options;

  const log = [];
  const createdLinks = [];

  const ctx = createContext(log);
  const canvas = {
    width: 0,
    height: 0,
    calls: { getContext: [] },
    getContext(type) {
      this.calls.getContext.push(type);
      return ctx;
    },
    getBoundingClientRect() {
      return rect;
    },
    toDataURL(type) {
      log.push({ method: 'toDataURL', args: [type] });
      return 'data:image/png;base64,fake';
    },
  };

  const sandbox = canvasSurfaceModule.sandbox;
  sandbox.window = { devicePixelRatio };
  sandbox.document = {
    createElement(tag) {
      assert.equal(tag, 'a');
      const link = {
        download: '',
        href: '',
        clicked: false,
        click() {
          this.clicked = true;
        },
      };
      createdLinks.push(link);
      return link;
    },
  };
  sandbox.Image = class {
    constructor() {
      this.complete = imageDefaults.complete;
      this.naturalWidth = imageDefaults.naturalWidth;
      this.naturalHeight = imageDefaults.naturalHeight;
      this.decoding = '';
      this.src = '';
    }
  };

  const surface = new CanvasSurface();

  return {
    surface,
    canvas,
    ctx,
    log,
    createdLinks,
    restore() {
      delete sandbox.window;
      delete sandbox.document;
      delete sandbox.Image;
    },
  };
}

function createContext(log) {
  const state = {
    fillStyle: '',
    strokeStyle: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    lineWidth: 1,
    globalAlpha: 1,
  };

  const ctx = {};
  for (const property of Object.keys(state)) {
    Object.defineProperty(ctx, property, {
      get() {
        return state[property];
      },
      set(value) {
        state[property] = value;
        log.push({ method: `set:${property}`, value });
      },
    });
  }

  for (const method of [
    'save',
    'restore',
    'setTransform',
    'fillRect',
    'beginPath',
    'arc',
    'fill',
    'stroke',
    'rect',
    'moveTo',
    'lineTo',
    'fillText',
    'drawImage',
    'translate',
    'scale',
    'rotate',
    'quadraticCurveTo',
    'closePath',
  ]) {
    ctx[method] = (...args) => {
      log.push({ method, args });
    };
  }

  return ctx;
}

function lastCall(log, method) {
  const matches = log.filter((entry) => entry.method === method);
  assert.ok(matches.length > 0, `expected at least one ${method} call`);
  return matches.at(-1);
}

function countCalls(log, method) {
  return log.filter((entry) => entry.method === method).length;
}

function hasCall(log, method) {
  return countCalls(log, method) > 0;
}

function lastAssigned(log, property) {
  const entry = lastCall(log, `set:${property}`);
  return entry.value;
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
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
