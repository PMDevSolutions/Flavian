import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/ipc-channels';
import type { DockerCommand, DockerService } from '../shared/types/docker';
import type { InitResult } from '../shared/types/init';
import type { PipelineResult } from '../shared/types/pipeline';
import type { QaArtifacts } from '../shared/types/qa';
import type { FlavianBridge, TaskEventEnvelope } from '../shared/types/ipc';
import type { PrereqReport } from '../shared/types/prerequisites';
import type { ProjectRef } from '../shared/types/project';
import type { TaskEvent, TaskSnapshot } from '../shared/types/task';

const bridge: FlavianBridge = {
  getProject: () => ipcRenderer.invoke(IPC.projectGet) as Promise<ProjectRef>,
  selectProject: () => ipcRenderer.invoke(IPC.projectSelect) as Promise<ProjectRef>,
  selectDirectory: () => ipcRenderer.invoke(IPC.dialogDirectory) as Promise<string | null>,
  selectFile: (extensions: string[]) =>
    ipcRenderer.invoke(IPC.dialogFile, extensions) as Promise<string | null>,
  runPrereqCheck: () => ipcRenderer.invoke(IPC.prereqRun) as Promise<{ taskId: string }>,
  getPrereqResult: (taskId) => ipcRenderer.invoke(IPC.prereqResult, taskId) as Promise<PrereqReport>,
  runInit: (input) => ipcRenderer.invoke(IPC.initRun, input) as Promise<{ taskId: string }>,
  getInitResult: (taskId) => ipcRenderer.invoke(IPC.initResult, taskId) as Promise<InitResult>,
  runDocker: (command: DockerCommand, arg?: string) =>
    ipcRenderer.invoke(IPC.dockerRun, command, arg) as Promise<{ taskId: string }>,
  getDockerStatus: () => ipcRenderer.invoke(IPC.dockerStatus) as Promise<DockerService[]>,
  listThemes: () => ipcRenderer.invoke(IPC.listThemes) as Promise<string[]>,
  runPipeline: (input) => ipcRenderer.invoke(IPC.pipelineRun, input) as Promise<{ taskId: string }>,
  getPipelineResult: (taskId) => ipcRenderer.invoke(IPC.pipelineResult, taskId) as Promise<PipelineResult>,
  runQa: (script) => ipcRenderer.invoke(IPC.qaRun, script) as Promise<{ taskId: string }>,
  getQaArtifacts: () => ipcRenderer.invoke(IPC.qaArtifacts) as Promise<QaArtifacts>,
  readQaImage: (relPath) => ipcRenderer.invoke(IPC.qaImage, relPath) as Promise<string | null>,
  readQaText: (relPath) => ipcRenderer.invoke(IPC.qaText, relPath) as Promise<string | null>,
  openExternal: (url) => ipcRenderer.invoke(IPC.openExternal, url) as Promise<void>,
  openPath: (relPath) => ipcRenderer.invoke(IPC.openPath, relPath) as Promise<string>,
  getTaskSnapshot: (taskId) =>
    ipcRenderer.invoke(IPC.taskSnapshot, taskId) as Promise<TaskSnapshot | null>,
  cancelTask: (taskId) => ipcRenderer.invoke(IPC.taskCancel, taskId) as Promise<void>,
  onTaskEvent: (taskId, cb: (event: TaskEvent) => void) => {
    const listener = (_event: unknown, envelope: TaskEventEnvelope): void => {
      if (envelope.taskId === taskId) cb(envelope.event);
    };
    ipcRenderer.on(IPC.taskEvent, listener);
    return () => ipcRenderer.removeListener(IPC.taskEvent, listener);
  },
};

contextBridge.exposeInMainWorld('flavian', bridge);
