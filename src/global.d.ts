declare global {
  type ConsoleType = 'info' | 'stdout' | 'stderr';

  type ConsoleEntry = {
    id: number;
    type: ConsoleType;
    text: string;
    ts: number;
  };

  type SketchFile = {
    name: string;
    content: string;
  };

  type AssetEntry = {
    name: string;
    sourcePath?: string | null;
    absolutePath?: string | null;
    relativePath?: string | null;
  };

  type ProjectPayload = {
    projectName: string;
    projectPath?: string | null;
    activeFileName: string;
    files: SketchFile[];
    assets: AssetEntry[];
  };

  type ProjectSnapshot = {
    projectName: string;
    projectPath: string;
    activeFileName: string;
    files: SketchFile[];
    assets: AssetEntry[];
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
    files: SketchFile[];
    projectPath?: string | null;
  };

  type RuntimeFramePayload = {
    frameInfo: Record<string, unknown>;
    input: Record<string, unknown>;
    canvas: Record<string, unknown>;
  };

  type RuntimeQueryPayload = {
    runtimePath: string;
    files: SketchFile[];
    expression: string;
  };

  type RuntimeQueryResult = {
    ok: boolean;
    value?: unknown;
    error?: string;
  };

  interface Window {
    electronAPI: {
      pickAssets: () => Promise<string[]>;
      getProjectsRoot: () => Promise<string>;
      listProjects: () => Promise<ProjectLibraryEntry[]>;
      readProject: (projectPath: string) => Promise<ProjectSnapshot>;
      saveProject: (payload: ProjectPayload) => Promise<ProjectSnapshot>;
      detectRuntime: () => Promise<string | null>;
      startRuntime: (payload: RuntimeStartPayload) => Promise<Record<string, unknown>>;
      frameRuntime: (payload: RuntimeFramePayload) => Promise<Record<string, unknown>[]>;
      queryRuntime: (payload: RuntimeQueryPayload) => Promise<RuntimeQueryResult>;
      stopRuntime: () => Promise<void>;
      onMenuEvent: (channel: string, callback: () => void) => () => void;
      onRuntimeStdout: (callback: (value: string) => void) => () => void;
      onRuntimeStderr: (callback: (value: string) => void) => () => void;
      onRuntimeExit: (callback: (code: number) => void) => () => void;
    };
  }
}

export {};
