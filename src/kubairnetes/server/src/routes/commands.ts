import { Router } from 'express';
import { commandExecutor } from '../services/executor.js';
import { getProjectRoot } from '../utils/project.js';

export const commandsRouter = Router();

// Execute a command with SSE streaming
commandsRouter.post('/execute', async (req, res) => {
  const { command, dryRun = false, cwd } = req.body as {
    command: string;
    dryRun?: boolean;
    cwd?: string;
  };

  if (!command) {
    res.status(400).json({ error: 'command is required' });
    return;
  }

  // Use repo root as cwd — README commands use paths relative to repo root
  const effectiveCwd = cwd || getProjectRoot();

  // Set up SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  res.write(`data: ${JSON.stringify({ type: 'start', command, dryRun })}\n\n`);

  try {
    const execution = await commandExecutor.execute(command, dryRun, (chunk) => {
      res.write(`data: ${JSON.stringify({ type: 'output', chunk })}\n\n`);
    }, effectiveCwd);

    res.write(`data: ${JSON.stringify({
      type: 'complete',
      id: execution.id,
      exitCode: execution.exitCode,
      status: execution.status,
    })}\n\n`);
  } catch (err: any) {
    res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
  }

  res.end();
});

// Get command history
commandsRouter.get('/history', (_req, res) => {
  res.json(commandExecutor.getHistory());
});

// Cancel a running command
commandsRouter.post('/cancel/:id', (req, res) => {
  const success = commandExecutor.cancel(req.params['id']!);
  res.json({ success });
});

// Clear history
commandsRouter.delete('/history', (_req, res) => {
  commandExecutor.clearHistory();
  res.json({ success: true });
});
