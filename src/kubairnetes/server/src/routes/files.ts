import { Router } from 'express';
import { readdir } from 'fs/promises';
import path from 'path';
import { getProjectRoot } from '../utils/project.js';

export const filesRouter = Router();

interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  isReadme: boolean;
  isYaml: boolean;
  children?: FileEntry[];
}

const IGNORED = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', 'bin', 'obj',
  '__pycache__', '.vs', '.idea', 'coverage', '.terraform',
]);

async function buildTree(dirPath: string, depth = 0): Promise<FileEntry[]> {
  if (depth > 3) return [];

  let entries;
  try {
    entries = await readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const result: FileEntry[] = [];

  // Sort: directories first, then files
  const sorted = entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });

  for (const entry of sorted) {
    if (entry.name.startsWith('.') && entry.name !== '.github') continue;
    if (IGNORED.has(entry.name)) continue;

    const fullPath = path.join(dirPath, entry.name);
    const lower = entry.name.toLowerCase();

    if (entry.isDirectory()) {
      const children = await buildTree(fullPath, depth + 1);
      // Only include directories that have readmes or yamls somewhere
      const hasRelevant = children.some(c =>
        c.isReadme || c.isYaml || c.type === 'directory'
      );
      if (hasRelevant || depth < 2) {
        result.push({
          name: entry.name,
          path: fullPath,
          type: 'directory',
          isReadme: false,
          isYaml: false,
          children,
        });
      }
    } else if (entry.isFile()) {
      const isReadme = lower === 'readme.md' || lower === 'readme.markdown';
      const isYaml = lower.endsWith('.yaml') || lower.endsWith('.yml');
      const isMd = lower.endsWith('.md');

      if (isReadme || isYaml || isMd) {
        result.push({
          name: entry.name,
          path: fullPath,
          type: 'file',
          isReadme,
          isYaml,
        });
      }
    }
  }

  return result;
}

// Browse directory for README and YAML files
filesRouter.get('/browse', async (req, res) => {
  try {
    const dirPath = (req.query['path'] as string) || getProjectRoot();
    const tree = await buildTree(dirPath);
    res.json({ root: dirPath, entries: tree });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get the project root
filesRouter.get('/root', (_req, res) => {
  res.json({ root: getProjectRoot() });
});
