import type { Application, RequestHandler } from "express";
import { findFiles } from "./scan";

export interface MiddlewareRegistryOptions {
  /** Directory to scan, e.g. path.join(process.cwd(), "shared", "middlewares") */
  middlewaresDir: string;
  /** File suffix identifying a global middleware module. Default: ".middleware.js" */
  suffix?: string;
}

/**
 * Auto-discovery for GLOBAL middlewares only — things that must run on every
 * request (logger, config attachment, i18n loader...). Files are mounted in
 * alphabetical order, so name them with a numeric prefix when order matters
 * (e.g. "01-logger.middleware.js").
 *
 * This is deliberately NOT for feature-scoped middlewares like an auth guard:
 * those must apply to specific routes only, never to 100% of requests, so they
 * stay a plain import in whichever route file needs them (see auth.route.js in
 * @forja/addon-auth) instead of being auto-mounted here.
 */
export class MiddlewareRegistry {
  constructor(
    private readonly app: Application,
    private readonly options: MiddlewareRegistryOptions
  ) {}

  /** Loads every matching global middleware file and mounts it. Returns the file paths loaded. */
  load(): string[] {
    const suffix = this.options.suffix ?? ".middleware.js";
    const files = findFiles(this.options.middlewaresDir, suffix);

    for (const file of files) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require(file);
      const handler = (mod?.default ?? mod) as RequestHandler | undefined;

      if (typeof handler !== "function") {
        throw new Error(
          `Global middleware module "${file}" must export an Express middleware function.`
        );
      }

      this.app.use(handler);
    }

    return files;
  }
}
