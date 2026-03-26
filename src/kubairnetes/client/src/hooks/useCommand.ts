import { useState, useCallback, useRef } from 'react';
import { executeCommand as apiExecuteCommand, getCommandHistory } from '../lib/api';
import type { CommandExecution } from '../lib/types';

interface CommandState {
  output: string;
  isRunning: boolean;
  currentCommand: string | null;
  history: CommandExecution[];
}

export function useCommand() {
  const [state, setState] = useState<CommandState>({
    output: '',
    isRunning: false,
    currentCommand: null,
    history: [],
  });
  const cancelRef = useRef<(() => void) | null>(null);

  const execute = useCallback((command: string, dryRun = false, cwd?: string) => {
    setState(s => ({
      ...s,
      output: '',
      isRunning: true,
      currentCommand: command,
    }));

    const cancel = apiExecuteCommand(command, dryRun, {
      onOutput(chunk) {
        setState(s => ({ ...s, output: s.output + chunk }));
      },
      onComplete(result) {
        setState(s => ({
          ...s,
          isRunning: false,
          history: [
            {
              id: result.id,
              command,
              status: result.status as any,
              output: s.output,
              exitCode: result.exitCode,
              startedAt: new Date().toISOString(),
              completedAt: new Date().toISOString(),
              dryRun,
            },
            ...s.history,
          ],
        }));
      },
      onError(message) {
        setState(s => ({
          ...s,
          isRunning: false,
          output: s.output + `\n\x1b[31mError: ${message}\x1b[0m`,
        }));
      },
    }, cwd);

    cancelRef.current = cancel;
  }, []);

  const cancel = useCallback(() => {
    cancelRef.current?.();
    setState(s => ({ ...s, isRunning: false }));
  }, []);

  const clearOutput = useCallback(() => {
    setState(s => ({ ...s, output: '' }));
  }, []);

  return {
    ...state,
    execute,
    cancel,
    clearOutput,
  };
}
