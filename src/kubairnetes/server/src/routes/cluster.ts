import { Router } from 'express';
import { fetchClusterState } from '../services/cluster-state.js';

export const clusterRouter = Router();

// Get current cluster state
clusterRouter.get('/state', async (req, res) => {
  try {
    const namespace = req.query['namespace'] as string | undefined;
    const state = await fetchClusterState(namespace);
    res.json(state);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// SSE watch endpoint — streams cluster state updates
clusterRouter.get('/watch', async (req, res) => {
  const namespace = req.query['namespace'] as string | undefined;
  const intervalMs = Math.max(3000, Math.min(30000, Number(req.query['interval']) || 5000));

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  let lastHash = '';

  const sendState = async () => {
    try {
      const state = await fetchClusterState(namespace);
      // Simple hash to detect changes — JSON stringified pod count + names
      const hash = `${state.pods.length}:${state.pods.map(p => `${p.name}/${p.phase}/${p.containers.map(c => c.restartCount).join(',')}`).join('|')}`;
      const changed = hash !== lastHash;
      lastHash = hash;

      res.write(`data: ${JSON.stringify({ ...state, changed })}\n\n`);
    } catch (err: any) {
      res.write(`data: ${JSON.stringify({ error: err.message, changed: false })}\n\n`);
    }
  };

  // Send initial state immediately
  await sendState();

  const timer = setInterval(sendState, intervalMs);

  req.on('close', () => {
    clearInterval(timer);
  });
});
