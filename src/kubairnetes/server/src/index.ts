import express from 'express';
import cors from 'cors';
import { commandsRouter } from './routes/commands.js';
import { chatRouter } from './routes/chat.js';
import { clusterRouter } from './routes/cluster.js';
import { filesRouter } from './routes/files.js';
import { decksRouter } from './routes/decks.js';
import { getDb } from './services/db.js';
import { setModel, getModel, fetchAvailableModels } from './services/slide-generator.js';
import { getProjectRoot } from './utils/project.js';
import path from 'path';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors());
app.use(express.json());

// Serve built client in production
const clientDist = path.join(import.meta.dirname, '../../client/dist');
app.use(express.static(clientDist));

// Init SQLite database
getDb();

// API routes
app.use('/api/commands', commandsRouter);
app.use('/api/chat', chatRouter);
app.use('/api/cluster', clusterRouter);
app.use('/api/files', filesRouter);
app.use('/api/decks', decksRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: '1.0.0', model: getModel() });
});

// Model management
app.get('/api/models', async (_req, res) => {
  const models = await fetchAvailableModels();
  res.json({ models, current: getModel() });
});

app.put('/api/models', async (req, res) => {
  const { model } = req.body as { model: string };
  if (!model) {
    res.status(400).json({ error: 'model is required' });
    return;
  }
  const models = await fetchAvailableModels();
  if (!models.some(m => m.id === model)) {
    res.status(400).json({ error: `Invalid model. Available: ${models.map(m => m.id).join(', ')}` });
    return;
  }
  setModel(model);
  res.json({ model: getModel() });
});

// SPA fallback
app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n  ☸️  KubAIrnetes server running at http://localhost:${PORT}\n`);
});
