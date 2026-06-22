import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, extname } from 'node:path';

export function readJSON(filePath: string): unknown {
  const content = readFileSync(resolve(filePath), 'utf-8');
  return JSON.parse(content);
}

export function writeOutput(filePath: string, data: unknown): void {
  const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  writeFileSync(resolve(filePath), content + '\n', 'utf-8');
}

export function findJSONFiles(dirPath: string, recursive: boolean): string[] {
  const resolved = resolve(dirPath);
  if (!existsSync(resolved)) return [];

  const stat = statSync(resolved);
  if (stat.isFile()) {
    return extname(resolved) === '.json' ? [resolved] : [];
  }

  const results: string[] = [];
  const entries = readdirSync(resolved, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = resolve(resolved, entry.name);
    if (entry.isFile() && extname(entry.name) === '.json') {
      results.push(entryPath);
    } else if (entry.isDirectory() && recursive) {
      results.push(...findJSONFiles(entryPath, true));
    }
  }

  return results;
}
