import * as fs from "node:fs";
import * as path from "node:path";

const FRAGMENT_NAME = "package.fragment.json";

/**
 * Recursively copies every file from `layerDir` into `targetDir`, except
 * `package.fragment.json` (handled separately by mergeFragment). Later layers
 * overwrite files from earlier ones — each layer only owns its own files, so in
 * practice this never happens across layers of the *same* axis.
 */
export function copyLayer(layerDir: string, targetDir: string): void {
  if (!fs.existsSync(layerDir)) return;

  for (const entry of fs.readdirSync(layerDir, { withFileTypes: true })) {
    if (entry.name === FRAGMENT_NAME) continue;

    const from = path.join(layerDir, entry.name);
    const to = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      fs.mkdirSync(to, { recursive: true });
      copyLayer(from, to);
    } else {
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
    }
  }
}

type JsonObject = Record<string, unknown>;

function deepMerge(base: JsonObject, patch: JsonObject): JsonObject {
  const result: JsonObject = { ...base };

  for (const key of Object.keys(patch)) {
    const baseValue = base[key];
    const patchValue = patch[key];

    if (isPlainObject(baseValue) && isPlainObject(patchValue)) {
      result[key] = deepMerge(baseValue, patchValue);
    } else {
      result[key] = patchValue;
    }
  }

  return result;
}

function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Merges `layerDir/package.fragment.json` (if present) into the accumulated
 * package.json object. Each stack layer only ever describes its own additions
 * (dependencies/devDependencies/scripts/...) — never a full package.json.
 */
export function mergeFragment(pkg: JsonObject, layerDir: string): JsonObject {
  const fragmentPath = path.join(layerDir, FRAGMENT_NAME);
  if (!fs.existsSync(fragmentPath)) return pkg;

  const fragment = JSON.parse(fs.readFileSync(fragmentPath, "utf8")) as JsonObject;
  return deepMerge(pkg, fragment);
}
