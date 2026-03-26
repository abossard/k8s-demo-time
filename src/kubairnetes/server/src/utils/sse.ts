import type { Response } from 'express';

export function initSSE(res: Response): (type: string, data: Record<string, unknown>) => void {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  return (type: string, data: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
  };
}
