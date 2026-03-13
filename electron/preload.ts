import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  pickAssets: () => ipcRenderer.invoke('fs:pickAssets'),
  getProjectsRoot: () => ipcRenderer.invoke('fs:getProjectsRoot'),
  listProjects: () => ipcRenderer.invoke('fs:listProjects'),
  readProject: (projectPath: string) => ipcRenderer.invoke('fs:readProject', projectPath),
  saveProject: (payload: unknown) => ipcRenderer.invoke('fs:saveProject', payload),
  detectRuntime: () => ipcRenderer.invoke('runtime:detect'),
  startRuntime: (payload: unknown) => ipcRenderer.invoke('runtime:start', payload),
  frameRuntime: (payload: unknown) => ipcRenderer.invoke('runtime:frame', payload),
  queryRuntime: (payload: unknown) => ipcRenderer.invoke('runtime:query', payload),
  stopRuntime: () => ipcRenderer.invoke('runtime:stop'),
  onMenuEvent: (channel: string, callback: () => void) => {
    const valid = ['menu:new-sketch', 'menu:open-project', 'menu:save', 'menu:save-as', 'menu:toggle-comment'];
    if (!valid.includes(channel)) return () => {};

    const listener = () => callback();
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
  onRuntimeStdout: (callback: (value: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, value: string) => callback(value);
    ipcRenderer.on('runtime:stdout', listener);
    return () => ipcRenderer.removeListener('runtime:stdout', listener);
  },
  onRuntimeStderr: (callback: (value: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, value: string) => callback(value);
    ipcRenderer.on('runtime:stderr', listener);
    return () => ipcRenderer.removeListener('runtime:stderr', listener);
  },
  onRuntimeExit: (callback: (code: number) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, code: number) => callback(code);
    ipcRenderer.on('runtime:exit', listener);
    return () => ipcRenderer.removeListener('runtime:exit', listener);
  },
});
