import { Router } from 'express';
import { chatWithCopilot, explainCommand, generateSpeakerNotes } from '../services/copilot.js';

export const chatRouter = Router();

// Chat with AI (streaming via Copilot SDK)
chatRouter.post('/', async (req, res) => {
  const { messages, context } = req.body as {
    messages: { role: 'user' | 'assistant'; content: string }[];
    context?: string;
  };

  if (!messages?.length) {
    res.status(400).json({ error: 'messages array is required' });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  try {
    await chatWithCopilot(messages, context, (token) => {
      res.write(`data: ${JSON.stringify({ type: 'token', content: token })}\n\n`);
    });

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
  } catch (err: any) {
    res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
  }

  res.end();
});

// Explain a specific command
chatRouter.post('/explain', async (req, res) => {
  const { command } = req.body as { command: string };

  if (!command) {
    res.status(400).json({ error: 'command is required' });
    return;
  }

  try {
    const explanation = await explainCommand(command);
    res.json({ explanation });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Generate speaker notes for a slide
chatRouter.post('/notes', async (req, res) => {
  const { slideTitle, slideContent } = req.body as {
    slideTitle: string;
    slideContent: string;
  };

  if (!slideContent) {
    res.status(400).json({ error: 'slideContent is required' });
    return;
  }

  try {
    const notes = await generateSpeakerNotes(slideTitle ?? 'Untitled', slideContent);
    res.json({ notes });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
