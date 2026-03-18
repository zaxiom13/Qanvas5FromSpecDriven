import { _electron as electron, expect, test } from '@playwright/test';
import path from 'node:path';

const projectRoot = path.resolve(__dirname, '..', '..');

function uniqueProjectName(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function launchApp() {
  return electron.launch({
    args: ['.'],
    cwd: projectRoot,
    env: {
      ...process.env,
      CI: '1',
    },
  });
}

async function focusEditor(page: import('@playwright/test').Page) {
  await page.waitForSelector('.app-root', { timeout: 15_000 });
  const editor = page.locator('#monaco-editor');
  await expect(editor).toBeVisible({ timeout: 15_000 });
  await editor.click({ position: { x: 160, y: 32 } });
  await page.waitForTimeout(250);
}

async function readEditorText(page: import('@playwright/test').Page) {
  return page.locator('#monaco-editor .view-lines').innerText();
}

async function replaceEditorText(page: import('@playwright/test').Page, text: string) {
  await focusEditor(page);
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await page.keyboard.press('Backspace');
  await page.keyboard.insertText(text);
}

async function renameProject(page: import('@playwright/test').Page, nextName: string) {
  await page.locator('#project-name').click();
  const input = page.locator('#project-name-input');
  await expect(input).toBeVisible();
  await input.fill(nextName);
  await input.press('Enter');
  await expect(page.locator('#project-name')).toHaveText(nextName);
}

test.describe('Qanvas5 Electron app', () => {
  test('assets folder is visible even when empty', async () => {
    const app = await launchApp();
    const page = await app.firstWindow();

    try {
      await expect(page.locator('#asset-tree')).toContainText('/assets/');
      await expect(page.locator('#asset-tree')).toContainText('Empty');
      await expect(page.locator('#asset-drop-zone')).toContainText('Drop files here');
    } finally {
      await app.close();
    }
  });

  test('new file modal creates and selects a q file', async () => {
    const app = await launchApp();
    const page = await app.firstWindow();

    try {
      await page.locator('#btn-new-file').click();
      await expect(page.locator('#modal-new-file')).toBeVisible();
      await page.locator('#new-file-input').fill('helpers');
      await page.locator('#btn-new-file-confirm').click();

      await expect(page.locator('[data-file="helpers.q"]')).toBeVisible();
      await expect(page.locator('#active-tab-name')).toHaveText('helpers.q');
    } finally {
      await app.close();
    }
  });

  test('examples modal loads an example after discarding unsaved changes', async () => {
    const app = await launchApp();
    const page = await app.firstWindow();

    try {
      await page.locator('#btn-examples').click();
      await expect(page.locator('#modal-examples')).toBeVisible();
      await page.getByRole('button', { name: /Hello Circle/i }).click();
      await expect(page.locator('#modal-unsaved')).toBeVisible();
      await page.locator('#btn-unsaved-discard').click();

      await expect(page.locator('#project-name')).toHaveText('Hello Circle');
      await expect(page.locator('#modal-examples')).toBeHidden();
      await expect(page.locator('#console-output')).toContainText('Loaded example: Hello Circle');
      await expect(page.locator('#monaco-editor')).toContainText('p:enlist input`mouse;');
    } finally {
      await app.close();
    }
  });

  test('toggle comment action comments and uncomments Monaco content', async () => {
    const app = await launchApp();
    const page = await app.firstWindow();

    try {
      await focusEditor(page);

      const before = await readEditorText(page);
      await app.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0]?.webContents.send('menu:toggle-comment');
      });
      await page.waitForTimeout(250);
      const afterComment = await readEditorText(page);
      expect(afterComment).not.toBe(before);
      expect(afterComment).toContain('/setup:{');

      await app.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0]?.webContents.send('menu:toggle-comment');
      });
      await page.waitForTimeout(250);
      const afterUncomment = await readEditorText(page);
      expect(afterUncomment).toContain('setup:{');
      expect(afterUncomment).not.toContain('/setup:{');
    } finally {
      await app.close();
    }
  });

  test('primary+o opens the project library modal', async () => {
    const app = await launchApp();
    const page = await app.firstWindow();

    try {
      const modal = page.locator('#modal-projects');
      await expect(modal).toBeHidden();

      await focusEditor(page);
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+O' : 'Control+O');
      await expect(modal).toBeVisible();
      await expect(page.locator('#btn-projects-close')).toBeVisible();
    } finally {
      await app.close();
    }
  });

  test('save uses the predetermined project library and project browser shows the result', async () => {
    const app = await launchApp();
    const page = await app.firstWindow();
    const projectName = uniqueProjectName('playwright-save');

    try {
      await renameProject(page, projectName);
      await focusEditor(page);
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+S' : 'Control+S');

      await expect(page.locator('#console-output')).toContainText(`Saved ${projectName} to`);
      await expect(page.locator('#console-output')).toContainText('Qanvas5 Projects');

      await page.locator('#btn-projects').click();
      await expect(page.locator('#modal-projects')).toBeVisible();
      await expect(page.locator('#modal-projects')).toContainText(projectName);
      await expect(page.locator('#modal-projects')).toContainText('Qanvas5 Projects');
    } finally {
      await app.close();
    }
  });

  test('run then stop clears the console and leaves the stopped overlay', async () => {
    const app = await launchApp();
    const page = await app.firstWindow();

    try {
      const runButton = page.locator('#btn-run');
      await expect(runButton).toBeEnabled({ timeout: 15_000 });

      await runButton.click();
      await expect(page.locator('.btn-run-label')).toHaveText('Stop', { timeout: 15_000 });
      await expect(page.locator('#console-output')).toContainText('Running sketch.q', { timeout: 15_000 });

      await runButton.click();
      await expect(page.locator('.overlay-label')).toHaveText('Sketch stopped', { timeout: 15_000 });
      await expect(page.locator('.btn-run-label')).toHaveText('Run');
      await expect(page.locator('#console-output')).toHaveText('');
    } finally {
      await app.close();
    }
  });

  test('step, resume, stop, and step again keep the runtime controls stable', async () => {
    const app = await launchApp();
    const page = await app.firstWindow();

    try {
      const runButton = page.locator('#btn-run');
      const stepButton = page.locator('#btn-step');
      const pauseButton = page.locator('#btn-pause');
      const pauseLabel = page.locator('.btn-pause-label');

      await expect(runButton).toBeEnabled({ timeout: 15_000 });

      await stepButton.click();
      await expect(page.locator('#console-output')).toContainText('Setup completed. Press Step again for frame 0.', { timeout: 15_000 });
      await expect(pauseLabel).toHaveText('Resume');

      await stepButton.click();
      await expect(page.locator('#console-output')).toContainText('↦ Frame 0', { timeout: 15_000 });

      await pauseButton.click();
      await expect(pauseLabel).toHaveText('Pause', { timeout: 15_000 });

      await page.waitForTimeout(200);
      await pauseButton.click();
      await expect(pauseLabel).toHaveText('Resume', { timeout: 15_000 });

      await stepButton.click();
      await expect(page.locator('#console-output')).toContainText('↦ Frame 1', { timeout: 15_000 });

      await pauseButton.click();
      await expect(pauseLabel).toHaveText('Pause', { timeout: 15_000 });

      await runButton.click();
      await expect(page.locator('.overlay-label')).toHaveText('Sketch stopped', { timeout: 15_000 });

      await stepButton.click();
      await expect(page.locator('#console-output')).toContainText('Setup completed. Press Step again for frame 0.', { timeout: 15_000 });
      await expect(pauseLabel).toHaveText('Resume');
      await expect(page.locator('.overlay-label')).not.toHaveText('Sketch error');
      await expect(page.locator('#console-output')).not.toContainText('q runtime is not running.');
    } finally {
      await app.close();
    }
  });

  test('sidebar collapse toggle hides the rail and exposes the expand affordance', async () => {
    const app = await launchApp();
    const page = await app.firstWindow();

    try {
      await page.locator('#btn-sidebar-toggle').click();
      await expect(page.locator('#sidebar')).toHaveClass(/collapsed/);
      await expect(page.locator('#btn-sidebar-expand')).toBeVisible();

      await page.locator('#btn-sidebar-expand').click();
      await expect(page.locator('#sidebar')).not.toHaveClass(/collapsed/);
    } finally {
      await app.close();
    }
  });

  test('closing the last window quits the app instead of leaving it docked', async () => {
    const app = await launchApp();
    const page = await app.firstWindow();

    await page.waitForSelector('.app-root', { timeout: 15_000 });
    const closed = app.waitForEvent('close');
    await page.close();
    await closed;
  });

  test('practice verification accepts keyed-table city revenue answers', async () => {
    const app = await launchApp();
    const page = await app.firstWindow();

    try {
      await page.getByRole('button', { name: 'Practice' }).click();
      await expect(page.locator('#practice-panel')).toContainText('City Revenue Rollup');

      await replaceEditorText(page, `sales:([]
  city:\`London\`London\`Paris\`Paris\`Berlin\`Berlin;
  quarter:\`Q1\`Q2\`Q1\`Q2\`Q1\`Q2;
  revenue:120 140 90 110 80 70;
);

answer:select totalRevenue:sum revenue by city from sales where city in \`London\`Paris;
`);

      await page.locator('#btn-run').click();

      await expect(page.locator('.practice-status')).toHaveText('match', { timeout: 15_000 });
      await expect(page.locator('#practice-panel')).toContainText('Answer matches the expected output.');
      await expect(page.locator('#console-output')).toContainText('Verified: City Revenue Rollup');
      await expect(page.locator('#console-output')).not.toContainText('__QANVAS_ERROR__');
    } finally {
      await app.close();
    }
  });

  test('practice reveal answer loads a working solution into the editor', async () => {
    const app = await launchApp();
    const page = await app.firstWindow();

    try {
      await page.getByRole('button', { name: 'Practice' }).click();
      await expect(page.locator('#practice-panel')).toContainText('City Revenue Rollup');

      await page.locator('#btn-practice-show-answer').click();
      await expect(page.locator('#practice-panel')).toContainText('Working answer');
      await expect(page.locator('#practice-panel')).toContainText('answer:`totalRevenue xdesc');

      await page.locator('#btn-practice-load-answer').click();
      await expect(page.locator('#console-output')).toContainText('Loaded practice answer: City Revenue Rollup');

      const editorText = (await readEditorText(page)).replace(/\s+/g, ' ');
      expect(editorText).toContain('totals:select totalRevenue:sum revenue by city from sales;');
      expect(editorText).toContain('answer:`totalRevenue xdesc select city, totalRevenue from totals where totalRevenue >= 200;');

      await page.locator('#btn-run').click();

      await expect(page.locator('.practice-status')).toHaveText('match', { timeout: 15_000 });
      await expect(page.locator('#practice-panel')).toContainText('Answer matches the expected output.');
    } finally {
      await app.close();
    }
  });

  test('top-level show output stays grouped with its table header', async () => {
    const app = await launchApp();
    const page = await app.firstWindow();

    try {
      await replaceEditorText(page, `sales:([]
  city:\`London\`London\`Paris\`Paris\`Berlin\`Berlin;
  quarter:\`Q1\`Q2\`Q1\`Q2\`Q1\`Q2;
  revenue:120 140 90 110 80 70;
);

show select totalRevenue: sum revenue by city from sales;

setup:{
  \`size\`bg!(800 600;0xF4ECD8)
}

draw:{[state;frameInfo;input;canvas]
  state
}
`);

      await page.locator('#btn-run').click();
      await expect(page.locator('#console-output')).toContainText('city');
      await expect(page.locator('#console-output')).toContainText('Paris');

      const lines = await page.locator('#console-output .console-line .console-text').allInnerTexts();
      const runningIndex = lines.indexOf('▶ Running sketch.q');
      const headerIndex = lines.indexOf('city | totalRevenue');
      const dividerIndex = lines.indexOf('------| ------------');
      const berlinIndex = lines.indexOf('Berlin| 150');
      const londonIndex = lines.indexOf('London| 260');
      const parisIndex = lines.indexOf('Paris | 200');

      expect(runningIndex).toBeGreaterThanOrEqual(0);
      expect(headerIndex).toBeGreaterThan(runningIndex);
      expect(dividerIndex).toBeGreaterThan(headerIndex);
      expect(berlinIndex).toBeGreaterThan(dividerIndex);
      expect(londonIndex).toBeGreaterThan(berlinIndex);
      expect(parisIndex).toBeGreaterThan(londonIndex);
    } finally {
      await app.close();
    }
  });
});
