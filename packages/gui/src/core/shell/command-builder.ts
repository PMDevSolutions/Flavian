import type { RunSpec } from '../process/runner-types';
import type { ShellResolver } from './shell-resolver';

/**
 * Turns "run this kind of thing" intent into a concrete RunSpec, resolving the
 * right executable via the ShellResolver. This is the single place that knows how
 * each orchestrated tool is invoked; sub-issues 2–6 add methods here.
 */
export class CommandBuilder {
  constructor(private readonly shell: ShellResolver) {}

  /** Run a repo bash script: `bash <scriptAbsPath> ...args`. */
  async bashScript(scriptAbsPath: string, args: readonly string[], cwd: string): Promise<RunSpec> {
    const bash = await this.shell.resolveBash();
    return { command: bash, args: [scriptAbsPath, ...args], cwd, lineBuffered: true };
  }

  /** Run an inline bash command: `bash -c "<command>"` (for pnpm scripts with redirection). */
  async bashCommand(command: string, cwd: string): Promise<RunSpec> {
    const bash = await this.shell.resolveBash();
    return { command: bash, args: ['-c', command], cwd, lineBuffered: true };
  }

  /** Run a Node script with the current Node binary (e.g. bin/flavian.mjs for InDesign). */
  nodeBin(scriptAbsPath: string, args: readonly string[], cwd: string): RunSpec {
    return { command: process.execPath, args: [scriptAbsPath, ...args], cwd, lineBuffered: true };
  }

  /** Run `docker compose <args>` (resolved docker, or bare 'docker' if not found). */
  async dockerCompose(args: readonly string[], cwd: string): Promise<RunSpec> {
    const docker = (await this.shell.resolveTool('docker')) ?? 'docker';
    return { command: docker, args: ['compose', ...args], cwd, lineBuffered: true };
  }

  /** Run the Claude Code CLI (Figma pipeline; consumed by PtyRunner once enabled). */
  async claude(args: readonly string[], cwd: string): Promise<RunSpec> {
    const claude = (await this.shell.resolveTool('claude')) ?? 'claude';
    return { command: claude, args: [...args], cwd, lineBuffered: true };
  }
}
