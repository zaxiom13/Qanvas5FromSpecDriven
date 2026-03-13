import { EXAMPLES } from '$lib/examples';
import { PRACTICE_CHALLENGES, getPracticeChallenge } from '$lib/practice-challenges';

const STORAGE_KEYS = {
  runtimePath: 'runtimePath',
  projectName: 'qanvas5:projectName',
  sidebarCollapsed: 'qanvas5:sidebarCollapsed',
  workspaceMode: 'qanvas5:workspaceMode',
  practiceChallengeId: 'qanvas5:practiceChallengeId',
};

const DEFAULT_PROJECT_NAME = 'untitled';
const PRACTICE_FILE_NAME = 'practice.q';

export const DEFAULT_SKETCH = `setup:{
  \`size\`bg!(800 600;0xF4ECD8)
}

draw:{[state;frameInfo;input;canvas]
  background[0xF4ECD8];
  circle[([]
    p:enlist 0.5*canvas\`size;
    r:enlist 44+18*sin 0.05*frameInfo\`frameNum;
    fill:enlist 0x5B6FE8;
    alpha:enlist 0.92
  )];
  state
}
`;

const SKETCH_ADJECTIVES = ['cosmic', 'warm', 'gentle', 'ember', 'lunar', 'quiet', 'velvet', 'mellow', 'glowing', 'soft', 'golden', 'tender'];
const SKETCH_NOUNS = ['spiral', 'glow', 'bloom', 'ripple', 'drift', 'garden', 'echo', 'field', 'trail', 'galaxy', 'current'];

type OverlayMode = 'idle' | 'running' | 'stopped' | 'error' | 'runtime-missing';
type ModalName = null | 'settings' | 'new-file' | 'examples' | 'projects' | 'export-gif' | 'unsaved';
type UnsavedDecision = 'continue' | 'discard' | 'cancel';
type WorkspaceMode = 'studio' | 'practice';
type PracticeVerification = {
  status: 'idle' | 'match' | 'mismatch' | 'error';
  actual: unknown;
  expected: unknown;
  message: string;
};

function readStored(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    return;
  }
}

function joinPath(...parts: string[]) {
  return parts.join('/').replace(/\/+/g, '/');
}

class AppState {
  projectPath = $state<string | null>(null);
  projectName = $state(readStored(STORAGE_KEYS.projectName) || DEFAULT_PROJECT_NAME);
  projectNameDraft = $state(this.projectName);
  files = $state<SketchFile[]>([{ name: 'sketch.q', content: DEFAULT_SKETCH }]);
  activeFileName = $state('sketch.q');
  practiceSource = $state(getPracticeChallenge(readStored(STORAGE_KEYS.practiceChallengeId) || PRACTICE_CHALLENGES[0].id).starterCode);
  assets = $state<AssetEntry[]>([]);
  unsaved = $state(true);
  projectsRoot = $state('');
  projectLibrary = $state<ProjectLibraryEntry[]>([]);
  projectLibraryLoading = $state(false);

  runtimePath = $state(readStored(STORAGE_KEYS.runtimePath) || '');
  runtimePathDraft = $state(this.runtimePath);
  runtimeOk = $state(Boolean(this.runtimePath));
  runtimeDetectStatus = $state('');
  runtimeDetectTone = $state<'idle' | 'ok' | 'error'>('idle');

  running = $state(false);
  paused = $state(false);
  runtimeTransitioning = $state(false);
  overlayMode = $state<OverlayMode>(this.runtimeOk ? 'idle' : 'runtime-missing');
  overlayMessage = $state('');
  showFps = $state(false);
  fps = $state(0);
  currentCanvasSize = $state<[number, number]>([1200, 800]);
  workspaceMode = $state<WorkspaceMode>(readStored(STORAGE_KEYS.workspaceMode) === 'practice' ? 'practice' : 'studio');
  practiceChallengeId = $state(readStored(STORAGE_KEYS.practiceChallengeId) || PRACTICE_CHALLENGES[0].id);
  practiceVerification = $state<PracticeVerification | null>(null);
  debugPendingSteps = $state(0);
  debugFrameNumber = $state(0);

  sidebarCollapsed = $state(readStored(STORAGE_KEYS.sidebarCollapsed) === '1');
  consoleFilter = $state<'all' | 'stdout' | 'stderr'>('all');
  consoleEntries = $state<ConsoleEntry[]>([]);
  activeModal = $state<ModalName>(null);
  newFileName = $state('');
  gifDuration = $state('3');
  exampleCategory = $state('All');
  renamingProject = $state(false);
  runNonce = $state(0);

  private booted = false;
  private unsavedResolver: ((decision: UnsavedDecision) => void) | null = null;
  private exportPngHandler: (() => void) | null = null;
  private exportGifHandler: ((durationSeconds: number) => void) | null = null;
  private autosaveTimer: ReturnType<typeof setTimeout> | null = null;
  private debugStepHoldTimer: ReturnType<typeof setInterval> | null = null;
  private dirtyRevision = 0;
  private consoleEntryId = 0;
  private runtimeRefreshWanted = false;
  private saveQueue: Promise<void> = Promise.resolve();
  private ignoreNextRuntimeExit = false;
  private runtimeActionQueue: Promise<void> = Promise.resolve();
  private expectedRuntimeStop = false;

  get activeFile(): SketchFile {
    return this.files.find((file) => file.name === this.activeFileName) ?? this.files[0];
  }

  get activeEditorKey() {
    return this.workspaceMode === 'practice' ? `${PRACTICE_FILE_NAME}:${this.practiceChallengeId}` : this.activeFileName;
  }

  get activeEditorValue() {
    return this.workspaceMode === 'practice' ? this.practiceSource : (this.activeFile?.content ?? '');
  }

  get filteredConsole() {
    return this.consoleFilter === 'all'
      ? this.consoleEntries
      : this.consoleEntries.filter((entry) => entry.type === this.consoleFilter);
  }

  get exampleCategories() {
    return ['All', ...new Set(EXAMPLES.map((example) => example.category))];
  }

  get filteredExamples() {
    return EXAMPLES.filter((example) => this.exampleCategory === 'All' || example.category === this.exampleCategory);
  }

  get practiceChallenges() {
    return PRACTICE_CHALLENGES;
  }

  get activePracticeChallenge() {
    return getPracticeChallenge(this.practiceChallengeId);
  }

  initialize() {
    if (this.booted) return;
    this.booted = true;

    this.clearConsole(true);
    this.validateRuntime();
    if (this.workspaceMode === 'practice') {
      this.applyPracticeStarter();
    }
    void this.primeRuntimePath();
    void this.refreshProjectLibrary();

    window.electronAPI.onRuntimeStdout((value) => this.appendConsole('stdout', value));
    window.electronAPI.onRuntimeStderr((value) => this.handleRuntimeError(value));
    window.electronAPI.onRuntimeExit((code) => {
      if (this.ignoreNextRuntimeExit) {
        this.ignoreNextRuntimeExit = false;
        return;
      }

      if (!this.running) return;
      this.appendConsole('info', `q process exited (code ${code})`);
      this.running = false;
      this.paused = false;
      this.overlayMode = this.runtimeOk ? 'idle' : 'runtime-missing';
    });

    window.electronAPI.onMenuEvent('menu:new-sketch', () => {
      void this.createNewSketch();
    });
    window.electronAPI.onMenuEvent('menu:open-project', () => {
      this.openProjectsModal();
    });
    window.electronAPI.onMenuEvent('menu:save', () => {
      void this.saveProject(false);
    });
    window.electronAPI.onMenuEvent('menu:save-as', () => {
      void this.saveProject(true);
    });
  }

  appendConsole(type: ConsoleType, text: string) {
    this.consoleEntryId += 1;
    this.consoleEntries = [...this.consoleEntries, { id: this.consoleEntryId, type, text, ts: Date.now() }].slice(-2000);
  }

  clearConsole(withWelcome = false) {
    this.consoleEntries = [];
    if (withWelcome) {
      this.appendConsole('info', 'Qanvas5 ready. Create, open, or run a sketch to get started.');
    }
  }

  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    writeStored(STORAGE_KEYS.sidebarCollapsed, this.sidebarCollapsed ? '1' : '0');
  }

  toggleFps() {
    this.showFps = !this.showFps;
  }

  async setWorkspaceMode(mode: WorkspaceMode) {
    if (mode === this.workspaceMode && mode !== 'practice') return;

    if (this.running) {
      await this.stopSketch(true);
    }

    this.workspaceMode = mode;
    writeStored(STORAGE_KEYS.workspaceMode, mode);
    this.practiceVerification = null;

    if (mode === 'practice') {
      this.applyPracticeStarter();
    }
  }

  setPracticeChallenge(challengeId: string) {
    this.practiceChallengeId = getPracticeChallenge(challengeId).id;
    writeStored(STORAGE_KEYS.practiceChallengeId, this.practiceChallengeId);
    this.practiceVerification = null;
    if (this.workspaceMode === 'practice') {
      this.applyPracticeStarter();
    }
  }

  startProjectRename() {
    this.renamingProject = true;
    this.projectNameDraft = this.projectName;
  }

  finishProjectRename(commit: boolean) {
    if (commit) {
      const nextName = this.projectNameDraft.trim() || DEFAULT_PROJECT_NAME;
      const changed = nextName !== this.projectName;
      this.setProjectName(nextName);
      if (changed) {
        this.markDirty();
      }
    } else {
      this.projectNameDraft = this.projectName;
    }
    this.renamingProject = false;
  }

  setProjectName(value: string, persist = true) {
    this.projectName = value.trim() || DEFAULT_PROJECT_NAME;
    this.projectNameDraft = this.projectName;
    if (persist) {
      writeStored(STORAGE_KEYS.projectName, this.projectName);
    }
  }

  updateActiveEditorContent(content: string) {
    if (this.workspaceMode === 'practice') {
      if (this.practiceSource === content) return;
      this.practiceSource = content;
      this.practiceVerification = null;
      return;
    }

    if (this.activeFile?.content === content) return;
    this.files = this.files.map((file) => (file.name === this.activeFileName ? { ...file, content } : file));
    this.practiceVerification = null;
    this.markDirty({ refreshRuntime: true });
  }

  selectFile(name: string) {
    this.activeFileName = name;
  }

  openNewFileModal() {
    this.newFileName = '';
    this.activeModal = 'new-file';
  }

  openProjectsModal() {
    this.activeModal = 'projects';
    void this.refreshProjectLibrary();
  }

  closeModal(name?: ModalName) {
    if (!name || this.activeModal === name) {
      this.activeModal = null;
    }
  }

  registerCanvasExports(png: (() => void) | null, gif: ((durationSeconds: number) => void) | null) {
    this.exportPngHandler = png;
    this.exportGifHandler = gif;
  }

  createFile() {
    const rawName = this.newFileName.trim();
    if (!rawName) return;

    const nextName = rawName.includes('.') ? rawName : `${rawName}.q`;
    if (this.files.some((file) => file.name === nextName)) {
      return;
    }

    this.files = [...this.files, { name: nextName, content: `/ ${nextName}\n` }];
    this.activeFileName = nextName;
    this.newFileName = '';
    this.markDirty({ refreshRuntime: true });
    this.activeModal = null;
  }

  renameFile(oldName: string, newName: string) {
    const rawName = newName.trim();
    const trimmed = rawName.includes('.') ? rawName : `${rawName}.q`;
    if (!trimmed || trimmed === oldName || this.files.some((file) => file.name === trimmed)) {
      return;
    }

    this.files = this.files.map((file) => (file.name === oldName ? { ...file, name: trimmed } : file));
    if (this.activeFileName === oldName) {
      this.activeFileName = trimmed;
    }
    this.markDirty({ refreshRuntime: true });
  }

  deleteFile(name: string) {
    if (name === 'sketch.q') return;
    this.files = this.files.filter((file) => file.name !== name);
    if (!this.files.some((file) => file.name === this.activeFileName)) {
      this.activeFileName = this.files[0]?.name ?? 'sketch.q';
    }
    this.markDirty({ refreshRuntime: true });
  }

  async importAssets() {
    const paths = await window.electronAPI.pickAssets();
    if (!paths.length) return;

    const existing = new Set(this.assets.map((asset) => asset.name));
    const nextAssets = [...this.assets];

    for (const assetPath of paths) {
      const name = assetPath.split('/').pop() || assetPath;
      if (existing.has(name)) continue;
      existing.add(name);
      nextAssets.push({
        name,
        sourcePath: assetPath,
        relativePath: joinPath('assets', name),
      });
      this.appendConsole('info', `Asset imported: ${name}`);
    }

    this.assets = nextAssets;
    this.markDirty({ refreshRuntime: true });
  }

  async detectRuntime() {
    this.runtimeDetectStatus = 'Detecting…';
    this.runtimeDetectTone = 'idle';

    const detected = await window.electronAPI.detectRuntime();
    if (!detected) {
      this.runtimeDetectStatus = 'q not found on PATH.';
      this.runtimeDetectTone = 'error';
      return;
    }

    this.runtimePathDraft = detected;
    this.runtimeDetectStatus = `Found: ${detected}`;
    this.runtimeDetectTone = 'ok';
  }

  saveSettings() {
    this.runtimePath = this.runtimePathDraft.trim();
    writeStored(STORAGE_KEYS.runtimePath, this.runtimePath);
    this.validateRuntime();
    this.activeModal = null;
  }

  validateRuntime() {
    this.runtimeOk = this.runtimePath.length > 0;
    if (!this.running) {
      this.overlayMode = this.runtimeOk ? 'idle' : 'runtime-missing';
    }
  }

  async confirmUnsaved() {
    if (!this.unsaved) return 'continue' as const;
    this.activeModal = 'unsaved';

    return new Promise<UnsavedDecision>((resolve) => {
      this.unsavedResolver = resolve;
    });
  }

  resolveUnsaved(decision: UnsavedDecision) {
    this.activeModal = null;
    this.unsavedResolver?.(decision);
    this.unsavedResolver = null;
  }

  async saveFromUnsavedModal() {
    const saved = await this.saveProject(false);
    this.resolveUnsaved(saved ? 'continue' : 'cancel');
  }

  async createNewSketch(template = DEFAULT_SKETCH, name = this.generateSketchName()) {
    const decision = await this.confirmUnsaved();
    if (decision === 'cancel') return false;

    await this.stopSketch(true);
    this.clearAutosave();

    this.projectPath = null;
    this.setProjectName(name);
    this.files = [{ name: 'sketch.q', content: template }];
    this.activeFileName = 'sketch.q';
    this.assets = [];
    this.dirtyRevision = 1;
    this.runtimeRefreshWanted = false;
    this.unsaved = true;
    this.overlayMode = this.runtimeOk ? 'idle' : 'runtime-missing';
    this.appendConsole('info', `New sketch: ${this.projectName}`);
    return true;
  }

  async loadExample(exampleId: string) {
    const example = EXAMPLES.find((entry) => entry.id === exampleId);
    if (!example) return;

    const created = await this.createNewSketch(example.code, example.name);
    if (!created) return;
    this.appendConsole('info', `Loaded example: ${example.name}`);
    this.activeModal = null;
  }

  async openProject(projectPath: string) {
    const decision = await this.confirmUnsaved();
    if (decision === 'cancel') return;

    const snapshot = await window.electronAPI.readProject(projectPath);
    this.loadProject(snapshot);
    this.activeModal = null;
  }

  loadProject(snapshot: ProjectSnapshot) {
    this.clearAutosave();
    this.projectPath = snapshot.projectPath;
    this.setProjectName(snapshot.projectName);
    this.files = snapshot.files.length ? snapshot.files : [{ name: 'sketch.q', content: DEFAULT_SKETCH }];
    this.activeFileName = this.files.some((file) => file.name === snapshot.activeFileName)
      ? snapshot.activeFileName
      : (this.files[0]?.name ?? 'sketch.q');
    this.assets = snapshot.assets;
    this.dirtyRevision = 0;
    this.runtimeRefreshWanted = false;
    this.unsaved = false;
    this.overlayMessage = '';
    this.overlayMode = this.runtimeOk ? 'idle' : 'runtime-missing';
    this.appendConsole('info', `Opened project: ${snapshot.projectName}`);
  }

  async saveProject(forceChoosePath: boolean, options: { silent?: boolean } = {}) {
    return this.withSaveLock(async () => {
      let targetPath = this.projectPath;
      if (!targetPath || forceChoosePath) {
        targetPath = null;
      }

      const revisionAtStart = this.dirtyRevision;
      const payloadFiles = this.files.map((file) => ({ ...file }));
      const payloadAssets = this.assets.map((asset) => ({ ...asset }));

      const snapshot = await window.electronAPI.saveProject({
        projectName: this.projectName,
        projectPath: targetPath,
        activeFileName: this.activeFileName,
        files: payloadFiles,
        assets: payloadAssets,
      });

      this.projectPath = snapshot.projectPath;
      this.assets = this.assets.map((asset) => ({
        ...asset,
        absolutePath: joinPath(snapshot.projectPath, 'assets', asset.name),
        relativePath: joinPath('assets', asset.name),
      }));

      if (revisionAtStart === this.dirtyRevision) {
        this.unsaved = false;
      }

      if (!options.silent) {
        this.appendConsole('info', `Saved ${this.projectName} to ${snapshot.projectPath}`);
      }

      void this.refreshProjectLibrary();

      return true;
    });
  }

  async runSketch() {
    if (this.workspaceMode === 'practice') {
      await this.verifyPracticeAnswer();
      return;
    }

    await this.withRuntimeLock(async () => {
      if (!this.runtimeOk) {
        await this.primeRuntimePath();
        if (!this.runtimeOk) return;
      }

      await this.startRuntimeFromProject(`▶ Running ${this.activeFileName}`);
    });
  }

  async stepSketch() {
    if (this.workspaceMode !== 'studio') return;

    await this.withRuntimeLock(async () => {
      if (!this.runtimeOk) {
        await this.primeRuntimePath();
        if (!this.runtimeOk) return;
      }

      if (!this.running) {
        const started = await this.startRuntimeFromProject('↦ Setup step', { paused: true });
        if (started) {
          this.debugFrameNumber = 0;
          this.appendConsole('info', 'Setup completed. Press Step again for frame 0.');
        }
        return;
      }

      if (!this.paused) {
        this.paused = true;
      }

      this.debugPendingSteps += 1;
      this.appendConsole('info', `↦ Frame ${this.debugFrameNumber}`);
    });
  }

  startStepHold() {
    if (this.workspaceMode !== 'studio' || this.debugStepHoldTimer) return;

    this.debugStepHoldTimer = setInterval(() => {
      void this.stepSketch();
    }, 120);
  }

  stopStepHold() {
    if (!this.debugStepHoldTimer) return;
    clearInterval(this.debugStepHoldTimer);
    this.debugStepHoldTimer = null;
  }

  async verifyPracticeAnswer() {
    const challenge = this.activePracticeChallenge;
    this.practiceVerification = null;

    await this.withRuntimeLock(async () => {
      try {
        if (!this.runtimeOk) {
          await this.primeRuntimePath();
          if (!this.runtimeOk) {
            this.practiceVerification = {
              status: 'error',
              actual: null,
              expected: challenge.expected,
              message: 'Configure the q runtime before verifying practice answers.',
            };
            return;
          }
        }

        const runtimeFiles = this.workspaceMode === 'practice'
          ? [{ name: PRACTICE_FILE_NAME, content: this.practiceSource }]
          : this.files.filter((file) => file.name.endsWith('.q'));
        const result = await window.electronAPI.queryRuntime({
          runtimePath: this.runtimePath,
          files: runtimeFiles.map((file) => ({ ...file })),
          expression: challenge.answerExpression,
        });

        if (!result.ok) {
          this.practiceVerification = {
            status: 'error',
            actual: null,
            expected: challenge.expected,
            message: result.error || 'Verification failed.',
          };
          this.appendConsole('stderr', result.error || 'Verification failed.');
          return;
        }

        const matches = stableValue(result.value) === stableValue(challenge.expected);
        this.practiceVerification = {
          status: matches ? 'match' : 'mismatch',
          actual: result.value,
          expected: challenge.expected,
          message: matches ? 'Answer matches the expected output.' : 'Output is valid q data, but it does not match the expected answer yet.',
        };
        this.appendConsole('info', matches ? `Verified: ${challenge.title}` : `Checked: ${challenge.title}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.practiceVerification = {
          status: 'error',
          actual: null,
          expected: challenge.expected,
          message,
        };
        this.appendConsole('stderr', message);
      }
    });
  }

  exportPng() {
    if (!this.exportPngHandler) {
      this.appendConsole('stderr', 'No canvas to export. Run the sketch first.');
      return;
    }

    this.exportPngHandler();
    this.appendConsole('info', 'PNG exported.');
  }

  openGifModal() {
    if (!this.running) {
      this.appendConsole('stderr', 'Sketch must be running to export GIF.');
      return;
    }

    this.gifDuration = '3';
    this.activeModal = 'export-gif';
  }

  startGifExport() {
    if (!this.exportGifHandler) {
      this.appendConsole('stderr', 'GIF export is unavailable until the canvas is running.');
      return;
    }

    const seconds = Number.parseInt(this.gifDuration, 10) || 3;
    this.activeModal = null;
    this.exportGifHandler(seconds);
  }

  async stopSketch(quiet = false) {
    await this.withRuntimeLock(async () => {
      if (quiet) {
        await this.stopRuntimeInternal(true);
        return;
      }

      await this.stopRuntimeInternal(true);
      this.clearConsole(false);
      this.overlayMode = 'stopped';
    });
  }

  pauseSketch() {
    if (!this.running) return;
    this.paused = !this.paused;
    this.appendConsole('info', this.paused ? '⏸ Paused' : '▶ Resumed');
  }

  handleRuntimeError(message: string) {
    if (this.expectedRuntimeStop && (message === 'Runtime stopped.' || message.startsWith('q exited with code'))) {
      return;
    }

    this.running = false;
    this.paused = false;
    this.runtimeTransitioning = false;
    this.overlayMode = 'error';
    this.overlayMessage = message;
    this.appendConsole('stderr', message);
  }

  setCanvasSize(size: [number, number]) {
    this.currentCanvasSize = size;
  }

  setFps(value: number) {
    this.fps = value;
  }

  setDebugFrameNumber(value: number) {
    this.debugFrameNumber = value;
  }

  completeDebugStep() {
    this.debugPendingSteps = Math.max(0, this.debugPendingSteps - 1);
  }

  generateSketchName() {
    let candidate = DEFAULT_PROJECT_NAME;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const adjective = SKETCH_ADJECTIVES[Math.floor(Math.random() * SKETCH_ADJECTIVES.length)];
      const noun = SKETCH_NOUNS[Math.floor(Math.random() * SKETCH_NOUNS.length)];
      candidate = `${adjective}-${noun}`;
      if (candidate !== this.projectName) break;
    }
    return candidate;
  }

  private async refreshProjectLibrary() {
    this.projectLibraryLoading = true;

    try {
      this.projectsRoot = await window.electronAPI.getProjectsRoot();
      this.projectLibrary = await window.electronAPI.listProjects();
    } finally {
      this.projectLibraryLoading = false;
    }
  }

  private async primeRuntimePath() {
    if (this.runtimePath) {
      this.validateRuntime();
      return;
    }

    const detected = await window.electronAPI.detectRuntime();
    if (!detected) {
      this.validateRuntime();
      return;
    }

    this.runtimePath = detected;
    this.runtimePathDraft = detected;
    writeStored(STORAGE_KEYS.runtimePath, detected);
    this.validateRuntime();
    this.appendConsole('info', `Detected q runtime at ${detected}`);
  }

  private markDirty(options: { refreshRuntime?: boolean } = {}) {
    this.dirtyRevision += 1;
    this.unsaved = true;

    if (options.refreshRuntime && this.running) {
      this.runtimeRefreshWanted = true;
    }

    this.scheduleAutosave();
  }

  private clearAutosave() {
    if (!this.autosaveTimer) return;
    clearTimeout(this.autosaveTimer);
    this.autosaveTimer = null;
  }

  private scheduleAutosave() {
    if (!this.projectPath) return;

    this.clearAutosave();
    this.autosaveTimer = setTimeout(() => {
      this.autosaveTimer = null;
      void this.flushAutosave();
    }, 450);
  }

  private async flushAutosave() {
    if (!this.projectPath || !this.unsaved) return;

    const revisionAtStart = this.dirtyRevision;
    const saved = await this.saveProject(false, { silent: true });
    if (!saved) return;

    if (revisionAtStart !== this.dirtyRevision) {
      this.scheduleAutosave();
      return;
    }

    if (this.runtimeRefreshWanted && this.running) {
      this.runtimeRefreshWanted = false;
      await this.withRuntimeLock(async () => {
        if (this.running) {
          await this.startRuntimeFromProject('↻ Live update');
        }
      });
    }
  }

  private applyPracticeStarter() {
    const challenge = this.activePracticeChallenge;
    this.practiceSource = challenge.starterCode;
    this.practiceVerification = null;
    this.appendConsole('info', `Loaded practice starter: ${challenge.title}`);
  }

  private async startRuntimeFromProject(message: string, options: { paused?: boolean } = {}) {
    const runtimePath = this.runtimePath?.trim();
    if (!runtimePath) {
      this.handleRuntimeError('q runtime path is missing. Configure the q binary in Settings.');
      return false;
    }

    const runtimeFiles = this.files.filter((file) => file.name.endsWith('.q'));
    if (!runtimeFiles.some((file) => file.name === 'sketch.q')) {
      this.handleRuntimeError('The project must include a sketch.q entry point.');
      return false;
    }

    this.runtimeTransitioning = true;
    await this.stopRuntimeInternal(true);
    this.appendConsole('info', message);

    try {
      await window.electronAPI.startRuntime({
        runtimePath,
        projectPath: this.projectPath,
        files: runtimeFiles.map((file) => ({ ...file })),
      });
      this.running = true;
      this.paused = Boolean(options.paused);
      this.runtimeTransitioning = false;
      this.overlayMode = 'running';
      this.overlayMessage = '';
      this.debugPendingSteps = 0;
      this.debugFrameNumber = 0;
      this.runNonce += 1;
      return true;
    } catch (error) {
      this.runtimeTransitioning = false;
      this.handleRuntimeError(error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  private async stopRuntimeInternal(quiet = false) {
    this.runtimeRefreshWanted = false;
    this.runtimeTransitioning = true;
    this.expectedRuntimeStop = this.running;
    this.stopStepHold();

    if (this.running) {
      this.ignoreNextRuntimeExit = true;
      await window.electronAPI.stopRuntime();
    }

    this.expectedRuntimeStop = false;
    this.running = false;
    this.paused = false;
    this.runtimeTransitioning = false;
    this.debugPendingSteps = 0;
    this.debugFrameNumber = 0;
    this.runNonce += 1;

    if (!quiet) {
      this.overlayMode = 'stopped';
      this.appendConsole('info', '■ Stopped');
    } else if (this.runtimeOk) {
      this.overlayMode = 'idle';
    }
  }

  private async withSaveLock<T>(task: () => Promise<T>) {
    const previous = this.saveQueue;
    let release!: () => void;
    this.saveQueue = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;

    try {
      return await task();
    } finally {
      release();
    }
  }

  private async withRuntimeLock<T>(task: () => Promise<T>) {
    const previous = this.runtimeActionQueue;
    let release!: () => void;
    this.runtimeActionQueue = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;

    try {
      return await task();
    } finally {
      release();
    }
  }
}

export const appState = new AppState();

function stableValue(value: unknown) {
  return JSON.stringify(value, (_key, entry) => {
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      return Object.fromEntries(Object.entries(entry as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)));
    }
    return entry;
  });
}
