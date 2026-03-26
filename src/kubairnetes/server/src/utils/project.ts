import { execSync } from 'child_process';
import path from 'path';

let _projectRoot: string | null = null;

export function getProjectRoot(): string {
  if (!_projectRoot) {
    try {
      _projectRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();
    } catch {
      _projectRoot = path.resolve(import.meta.dirname, '../../../..');
    }
  }
  return _projectRoot;
}

export function getCacheDir(): string {
  return path.join(getProjectRoot(), '.kubairnetes-cache');
}
