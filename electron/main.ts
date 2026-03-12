import { app, BrowserWindow, Menu, dialog, ipcMain } from 'electron';
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

type SketchFilePayload = {
  name: string;
  content: string;
};

type AssetPayload = {
  name: string;
  sourcePath?: string | null;
  absolutePath?: string | null;
  relativePath?: string | null;
};

type SaveProjectPayload = {
  projectName: string;
  projectPath?: string | null;
  activeFileName: string;
  files: SketchFilePayload[];
  assets: AssetPayload[];
};

type ProjectMeta = {
  projectName?: string;
  activeFileName?: string;
};

type ProjectLibraryEntry = {
  projectName: string;
  projectPath: string;
  updatedAt: number;
  fileCount: number;
  assetCount: number;
};

type RuntimeStartPayload = {
  runtimePath: string;
  files: SketchFilePayload[];
  projectPath?: string | null;
};

type RuntimeFramePayload = {
  frameInfo: Record<string, unknown>;
  input: Record<string, unknown>;
  canvas: Record<string, unknown>;
};

let mainWindow: BrowserWindow | null = null;
const PROJECT_META_FILE = '.qanvas.json';
const PROJECTS_DIR_NAME = 'Qanvas5 Projects';

function sendToRenderer(channel: string, ...args: unknown[]) {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const { webContents } = mainWindow;
  if (webContents.isDestroyed()) return;

  webContents.send(channel, ...args);
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  // Prevent process-level unhandled rejection warnings while callers still await the original promise.
  void promise.catch(() => {});
  return { promise, resolve, reject };
}

class QRuntimeSession {
  private child: ChildProcessWithoutNullStreams | null = null;
  private stdoutBuffer = '';
  private activeKind: 'INIT' | 'FRAME' | null = null;
  private activeDeferred: ReturnType<typeof createDeferred<string>> | null = null;
  private expectedExit = false;

  async start(payload: RuntimeStartPayload) {
    await this.stop();
    this.expectedExit = false;

    const runtimePath = payload.runtimePath?.trim();
    if (!runtimePath) {
      throw new Error('q runtime path is missing. Configure the q binary in Settings.');
    }

    if (!Array.isArray(payload.files) || payload.files.length === 0) {
      throw new Error('No q source files are loaded for this sketch.');
    }

    const bootSource = await fs.readFile(path.join(app.getAppPath(), 'runtime', 'boot.q'), 'utf8');
    const runtimeFiles = payload.files
      .filter((file) => file.name.endsWith('.q'))
      .sort((left, right) => {
        if (left.name === 'sketch.q') return 1;
        if (right.name === 'sketch.q') return -1;
        return left.name.localeCompare(right.name);
      });

    if (!runtimeFiles.some((file) => file.name === 'sketch.q')) {
      throw new Error('The project must include a sketch.q entry point.');
    }

    this.child = spawn(runtimePath, ['-q'], {
      stdio: 'pipe',
    });

    this.child.stdout.setEncoding('utf8');
    this.child.stderr.setEncoding('utf8');

    this.child.stdout.on('data', (chunk: string) => this.handleStdout(chunk));
    this.child.stderr.on('data', (chunk: string) => this.handleStderr(chunk));
    this.child.on('exit', (code) => this.handleExit(code ?? 0));

    await this.sendScript(bootSource);
    for (const file of runtimeFiles) {
      await this.sendScript(file.content);
    }

    const raw = await this.request('INIT', '.qv.init[];');
    return raw ? JSON.parse(raw) : {};
  }

  async frame(payload: RuntimeFramePayload) {
    if (!this.child) {
      throw new Error(this.expectedExit ? 'Runtime stopped.' : 'q runtime is not running.');
    }

    const raw = await this.request(
      'FRAME',
      `.qv.frame[${qString(JSON.stringify(payload.frameInfo))};${qString(JSON.stringify(payload.input))};${qString(JSON.stringify(payload.canvas))}];`
    );

    return raw ? JSON.parse(raw) : [];
  }

  async stop() {
    if (!this.child) return;

    this.expectedExit = true;
    this.rejectActive('Runtime stopped.');

    const child = this.child;
    this.child = null;
    this.stdoutBuffer = '';

    await new Promise<void>((resolve) => {
      child.once('exit', () => resolve());
      child.kill();
      setTimeout(() => resolve(), 500);
    });
  }

  private async send(command: string) {
    if (!this.child) {
      throw new Error('q runtime is not running.');
    }

    this.child.stdin.write(`${command}\n`);
  }

  private async sendScript(source: string) {
    const normalized = normalizeQScript(source);
    for (const statement of normalized) {
      await this.send(statement);
    }
  }

  private async request(kind: 'INIT' | 'FRAME', command: string) {
    if (this.activeDeferred) {
      throw new Error('q runtime is busy.');
    }

    this.activeKind = kind;
    this.activeDeferred = createDeferred<string>();
    await this.send(command);
    return this.activeDeferred.promise;
  }

  private clearActive() {
    this.activeKind = null;
    this.activeDeferred = null;
  }

  private rejectActive(message: string) {
    if (!this.activeDeferred) return;
    this.activeDeferred.reject(new Error(message));
    this.clearActive();
  }

  private resolveActive(kind: 'INIT' | 'FRAME', payload: string) {
    if (!this.activeDeferred || this.activeKind !== kind) {
      // Ignore stray protocol payloads that arrive after the active request has been cleared.
      return;
    }

    this.activeDeferred.resolve(payload);
    this.clearActive();
  }

  private handleStdout(chunk: string) {
    this.stdoutBuffer += chunk;
    const lines = this.stdoutBuffer.split(/\r?\n/);
    this.stdoutBuffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith('__QANVAS_INIT__')) {
        this.resolveActive('INIT', trimmed.slice('__QANVAS_INIT__'.length));
        continue;
      }

      if (trimmed.startsWith('__QANVAS_FRAME__')) {
        this.resolveActive('FRAME', trimmed.slice('__QANVAS_FRAME__'.length));
        continue;
      }

      if (trimmed.startsWith('__QANVAS_ERROR__')) {
        const message = trimmed.slice('__QANVAS_ERROR__'.length) || 'q runtime error';
        this.rejectActive(message);
        sendToRenderer('runtime:stderr', message);
        continue;
      }

      sendToRenderer('runtime:stdout', trimmed);
    }
  }

  private handleStderr(chunk: string) {
    const text = chunk.trim();
    if (!text) return;
    this.rejectActive(text);
    sendToRenderer('runtime:stderr', text);
  }

  private handleExit(code: number) {
    if (this.expectedExit) {
      this.clearActive();
      this.expectedExit = false;
    } else {
      this.rejectActive(`q exited with code ${code}`);
    }
    sendToRenderer('runtime:exit', code);
    this.child = null;
  }
}

const runtimeSession = new QRuntimeSession();

function normalizeQScript(source: string) {
  const statements: string[] = [];
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

function countChar(value: string, target: string) {
  return [...value].filter((char) => char === target).length;
}

function qString(value: string) {
  return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

function getProjectsRoot() {
  return path.join(app.getPath('documents'), PROJECTS_DIR_NAME);
}

async function ensureProjectsRoot() {
  const root = getProjectsRoot();
  await fs.mkdir(root, { recursive: true });
  return root;
}

function slugifyProjectName(projectName: string) {
  const slug = projectName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'untitled';
}

async function createProjectDirectory(projectName: string) {
  const root = await ensureProjectsRoot();
  const base = slugifyProjectName(projectName);

  for (let index = 0; index < 10_000; index += 1) {
    const suffix = index === 0 ? '' : `-${index + 1}`;
    const candidate = path.join(root, `${base}${suffix}`);

    try {
      await fs.access(candidate);
    } catch {
      await fs.mkdir(candidate, { recursive: true });
      return candidate;
    }
  }

  throw new Error('Could not create a new project folder in the Qanvas5 library.');
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1440,
    minHeight: 900,
    resizable: false,
    title: 'Qanvas5',
    backgroundColor: '#F8F5F0',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(app.getAppPath(), 'dist-electron', 'preload.js'),
    },
  });

  const rendererUrl = process.env.QANVAS_RENDERER_URL;
  if (rendererUrl) {
    await mainWindow.loadURL(rendererUrl);
  } else {
    await mainWindow.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'));
  }

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;

    const usesPrimaryModifier = process.platform === 'darwin' ? input.meta : input.control;
    if (!usesPrimaryModifier || input.alt) return;

    const key = input.key.toLowerCase();
    if (key === 'o') {
      event.preventDefault();
      mainWindow?.webContents.send('menu:open-project');
      return;
    }

    if (key === '/') {
      event.preventDefault();
      mainWindow?.webContents.send('menu:toggle-comment');
    }
  });

  buildMenu();
}

function buildMenu() {
  if (!mainWindow) return;

  const isMac = process.platform === 'darwin';
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' as const }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Sketch',
          accelerator: isMac ? 'Cmd+N' : 'Ctrl+N',
          click: () => mainWindow?.webContents.send('menu:new-sketch'),
        },
        {
          label: 'Projects',
          accelerator: isMac ? 'Cmd+O' : 'Ctrl+O',
          click: () => mainWindow?.webContents.send('menu:open-project'),
        },
        {
          label: 'Save',
          accelerator: isMac ? 'Cmd+S' : 'Ctrl+S',
          click: () => mainWindow?.webContents.send('menu:save'),
        },
        {
          label: 'Save Copy',
          accelerator: isMac ? 'Shift+Cmd+S' : 'Ctrl+Shift+S',
          click: () => mainWindow?.webContents.send('menu:save-as'),
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        {
          label: 'Toggle Comment',
          accelerator: isMac ? 'Cmd+/' : 'Ctrl+/',
          click: () => mainWindow?.webContents.send('menu:toggle-comment'),
        },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function readProject(projectPath: string) {
  let projectMeta: ProjectMeta = {};

  try {
    const rawMeta = await fs.readFile(path.join(projectPath, PROJECT_META_FILE), 'utf8');
    projectMeta = JSON.parse(rawMeta) as ProjectMeta;
  } catch {
    projectMeta = {};
  }

  const entries = await fs.readdir(projectPath, { withFileTypes: true });
  const files: SketchFilePayload[] = [];
  const assets: AssetPayload[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(projectPath, entry.name);
    if (entry.isFile() && entry.name.endsWith('.q')) {
      files.push({
        name: entry.name,
        content: await fs.readFile(absolutePath, 'utf8'),
      });
    }

    if (entry.isDirectory() && entry.name === 'assets') {
      const assetEntries = await fs.readdir(absolutePath, { withFileTypes: true });
      for (const assetEntry of assetEntries) {
        if (!assetEntry.isFile()) continue;
        assets.push({
          name: assetEntry.name,
          absolutePath: path.join(absolutePath, assetEntry.name),
          relativePath: path.join('assets', assetEntry.name),
        });
      }
    }
  }

  const orderedFiles = files
    .sort((left, right) => {
      if (left.name === 'sketch.q') return -1;
      if (right.name === 'sketch.q') return 1;
      return left.name.localeCompare(right.name);
    });

  if (!orderedFiles.find((file) => file.name === 'sketch.q')) {
    orderedFiles.unshift({
      name: 'sketch.q',
      content: '',
    });
  }

  return {
    projectName: projectMeta.projectName?.trim() || path.basename(projectPath),
    projectPath,
    activeFileName: projectMeta.activeFileName || 'sketch.q',
    files: orderedFiles,
    assets,
  };
}

async function saveProject(payload: SaveProjectPayload) {
  const projectPath = payload.projectPath?.trim() ? payload.projectPath : await createProjectDirectory(payload.projectName);
  await fs.mkdir(projectPath, { recursive: true });

  const keepFiles = new Set(payload.files.map((file) => file.name));

  for (const file of payload.files) {
    await fs.writeFile(path.join(projectPath, file.name), file.content, 'utf8');
  }

  const existingRootEntries = await fs.readdir(projectPath, { withFileTypes: true });
  for (const entry of existingRootEntries) {
    if (entry.isFile() && entry.name.endsWith('.q') && !keepFiles.has(entry.name)) {
      await fs.rm(path.join(projectPath, entry.name));
    }
  }

  const assetsDir = path.join(projectPath, 'assets');
  await fs.mkdir(assetsDir, { recursive: true });

  const keepAssets = new Set(payload.assets.map((asset) => asset.name));

  for (const asset of payload.assets) {
    const destination = path.join(assetsDir, asset.name);
    const source = asset.sourcePath ?? asset.absolutePath;
    if (source && source !== destination) {
      await fs.copyFile(source, destination);
    }
  }

  const existingAssets = await fs.readdir(assetsDir, { withFileTypes: true });
  for (const entry of existingAssets) {
    if (entry.isFile() && !keepAssets.has(entry.name)) {
      await fs.rm(path.join(assetsDir, entry.name));
    }
  }

  await fs.writeFile(
    path.join(projectPath, PROJECT_META_FILE),
    JSON.stringify(
      {
        projectName: payload.projectName,
        activeFileName: payload.activeFileName,
      },
      null,
      2
    ),
    'utf8'
  );

  return readProject(projectPath);
}

async function listProjects(): Promise<ProjectLibraryEntry[]> {
  const root = await ensureProjectsRoot();
  const entries = await fs.readdir(root, { withFileTypes: true });
  const projects: ProjectLibraryEntry[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const projectPath = path.join(root, entry.name);

    try {
      const snapshot = await readProject(projectPath);
      const stats = await fs.stat(projectPath);
      projects.push({
        projectName: snapshot.projectName,
        projectPath,
        updatedAt: stats.mtimeMs,
        fileCount: snapshot.files.length,
        assetCount: snapshot.assets.length,
      });
    } catch {
      continue;
    }
  }

  return projects.sort((left, right) => right.updatedAt - left.updatedAt);
}

async function detectRuntimePath() {
  const detected = spawnSync('which', ['q'], {
    encoding: 'utf8',
  });

  const candidate = detected.stdout.trim();
  if (detected.status === 0 && candidate) {
    return candidate;
  }

  return null;
}

ipcMain.handle('fs:pickAssets', async () => {
  if (!mainWindow) return [];

  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Import Assets',
    properties: ['openFile', 'multiSelections'],
  });

  return result.canceled ? [] : result.filePaths;
});

ipcMain.handle('fs:getProjectsRoot', async () => ensureProjectsRoot());
ipcMain.handle('fs:listProjects', async () => listProjects());
ipcMain.handle('fs:readProject', async (_event, projectPath: string) => readProject(projectPath));
ipcMain.handle('fs:saveProject', async (_event, payload: SaveProjectPayload) => saveProject(payload));
ipcMain.handle('runtime:detect', async () => detectRuntimePath());
ipcMain.handle('runtime:start', async (_event, payload: RuntimeStartPayload) => runtimeSession.start(payload));
ipcMain.handle('runtime:frame', async (_event, payload: RuntimeFramePayload) => {
  try {
    return await runtimeSession.frame(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'Runtime stopped.' || message === 'q runtime is not running.') {
      return [];
    }
    throw error;
  }
});
ipcMain.handle('runtime:stop', async () => runtimeSession.stop());

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  void runtimeSession.stop();
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createWindow();
  }
});
