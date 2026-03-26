import { readdir, stat, readFile } from 'fs/promises';
import path from 'path';

export interface ScanResult {
  basePath: string;
  readmeFiles: string[];
  yamlFiles: string[];
}

const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '__pycache__',
  'bin', 'obj', '.vs', '.idea', 'coverage', '.terraform',
]);

export async function scanDirectory(dirPath: string): Promise<ScanResult> {
  const readmeFiles: string[] = [];
  const yamlFiles: string[] = [];

  async function walk(dir: string, depth = 0): Promise<void> {
    if (depth > 5) return;

    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
          await walk(fullPath, depth + 1);
        }
      } else if (entry.isFile()) {
        const lower = entry.name.toLowerCase();
        if (lower === 'readme.md' || lower === 'readme.markdown') {
          readmeFiles.push(fullPath);
        } else if (lower.endsWith('.yaml') || lower.endsWith('.yml')) {
          yamlFiles.push(fullPath);
        }
      }
    }
  }

  await walk(dirPath);

  readmeFiles.sort();
  yamlFiles.sort();

  return { basePath: dirPath, readmeFiles, yamlFiles };
}

export async function readFileContent(filePath: string): Promise<string> {
  return readFile(filePath, 'utf-8');
}
