import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/ipc-channels';
import type { DockerCommand, DockerService } from '../shared/types/docker';
import type { InitResult } from '../shared/types/init';
import type { PipelineResult } from '../shared/types/pipeline';
import type { FlavianBridge, TaskEventEnvelope } from '../shared/types/ipc';
import type { PrereqReport } from '../shared/types/prerequisites';
import type { ProjectRef } from '../shared/types/project';
import type { TaskEvent, TaskSnapshot } from '../shared/types/task';

const bridge: FlavianBridge = {
  getProject: () => ipcRenderer.invoke(IPC.projectGet) as Promise<ProjectRef>,
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
