import type { Application, RequestHandler } from "express";
import { findFiles } from "./scan";

export interface RouteRegistryOptions {
  /** Directory to scan, e.g. path.join(process.cwd(), "features") */
  featuresDir: string;
  /** File suffix identifying a route module. Default: ".route.js" */
  suffix?: string;
}

/**
 * Auto-discovery for routes: scans `featuresDir` recursively for files ending
 * in `suffix` (default ".route.js"), requires each one, and mounts what it
 * exports (an Express Router) onto the app. Dropping a `<feature>.route.js`
 * file under features/ is enough to wire it up — nothing to register by hand,
 * no central list to keep in sync.
 */
export class RouteRegistry {
  constructor(
    private readonly app: Application,
    private readonly options: RouteRegistryOptions
  ) {}

  /** Loads every matching route file and mounts it. Returns the file paths loaded. */
  load(): string[] {
    const suffix = this.options.suffix ?? ".route.js";
    const files = findFiles(this.options.featuresDir, suffix);

    for (const file of files) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require(file);
      const router = (mod?.default ?? mod) as RequestHandler | undefined;

      if (typeof router !== "function") {
        throw new Error(
          `Route module "${file}" must export an Express Router (module.exports = router).`
        );
      }

      this.app.use(router);
    }

    return files;
  }
}
