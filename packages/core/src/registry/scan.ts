import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Recursively finds every file under `dir` whose name ends with `suffix`.
 * Returns an empty array if `dir` doesn't exist — a project without a given
 * folder (e.g. no shared/middlewares/) is valid, not an error.
 */
export function findFiles(dir: string, suffix: string): string[] {
  if (!fs.existsSync(dir)) return [];

  const results: string[] = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      results.push(...findFiles(full, suffix));
    } else if (entry.name.endsWith(suffix)) {
      results.push(full);
    }
  }

  return results;
}
