import { spawn, type ChildProcess } from 'child_process';
import crypto from 'crypto';

export interface CommandExecution {
  id: string;
  command: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  output: string;
  exitCode: number | null;
  startedAt: string;
  completedAt: string | null;
  dryRun: boolean;
}

const ALLOWED_COMMANDS = new Set([
  'kubectl', 'helm', 'az', 'curl', 'cat', 'echo', 'grep', 'jq',
  'watch', 'column', 'sort', 'head', 'tail', 'wc',
]);

const BLOCKED_PATTERNS = [
  /rm\s+-rf\s+\//,
  />\s*\/dev\/sd/,
  /mkfs\./,
  /dd\s+if=/,
];

const DRY_RUN_COMMANDS = new Set(['kubectl apply', 'kubectl create', 'kubectl delete', 'kubectl patch']);

function getBaseCommand(cmd: string): string {
  const match = cmd.match(/^\s*(\S+)/);
  return match?.[1] ?? '';
}

function isAllowed(cmd: string): boolean {
  const base = getBaseCommand(cmd);
  if (!ALLOWED_COMMANDS.has(base)) return false;
  return !BLOCKED_PATTERNS.some(p => p.test(cmd));
}

function addDryRun(cmd: string, dryRun: boolean): string {
  if (!dryRun) return cmd;
  for (const prefix of DRY_RUN_COMMANDS) {
    if (cmd.startsWith(prefix) && !cmd.includes('--dry-run')) {
      return cmd + ' --dry-run=client';
    }
  }
  return cmd;
}

export class CommandExecutor {
  private history: CommandExecution[] = [];
  private activeProcesses = new Map<string, ChildProcess>();

  async execute(
    command: string,
    dryRun: boolean,
    onOutput: (chunk: string) => void,
    cwd?: string,
  ): Promise<CommandExecution> {
    if (!isAllowed(command)) {
      const execution: CommandExecution = {
        id: crypto.randomUUID(),
        command,
        status: 'failed',
        output: `Command blocked: "${getBaseCommand(command)}" is not in the allowed commands list.`,
        exitCode: 1,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        dryRun,
      };
      this.history.push(execution);
      return execution;
    }

    const finalCmd = addDryRun(command, dryRun);
    const execution: CommandExecution = {
      id: crypto.randomUUID(),
      command: finalCmd,
      status: 'running',
      output: '',
      exitCode: null,
      startedAt: new Date().toISOString(),
      completedAt: null,
      dryRun,
    };

    this.history.push(execution);

    return new Promise<CommandExecution>((resolve) => {
      const proc = spawn('bash', ['-c', finalCmd], {
        env: { ...process.env },
        cwd: cwd || undefined,
        timeout: 120_000,
      });

      this.activeProcesses.set(execution.id, proc);

      proc.stdout.on('data', (data: Buffer) => {
        const text = data.toString();
        execution.output += text;
        onOutput(text);
      });

      proc.stderr.on('data', (data: Buffer) => {
        const text = data.toString();
        execution.output += text;
        onOutput(text);
      });

      proc.on('close', (code) => {
        execution.status = code === 0 ? 'completed' : 'failed';
        execution.exitCode = code;
        execution.completedAt = new Date().toISOString();
        this.activeProcesses.delete(execution.id);
        resolve(execution);
      });

      proc.on('error', (err) => {
        execution.status = 'failed';
        execution.output += `\nError: ${err.message}`;
        execution.exitCode = 1;
        execution.completedAt = new Date().toISOString();
        this.activeProcesses.delete(execution.id);
        resolve(execution);
      });
    });
  }

  cancel(id: string): boolean {
    const proc = this.activeProcesses.get(id);
    if (proc) {
      proc.kill('SIGTERM');
      this.activeProcesses.delete(id);
      const execution = this.history.find(h => h.id === id);
      if (execution) {
        execution.status = 'cancelled';
        execution.completedAt = new Date().toISOString();
      }
      return true;
    }
    return false;
  }

  getHistory(): CommandExecution[] {
    return [...this.history].reverse();
  }

  clearHistory(): void {
    this.history = [];
  }
}

export const commandExecutor = new CommandExecutor();
