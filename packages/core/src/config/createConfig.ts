export interface ConfigFieldSpec<T> {
  /** Environment variable name to read this field from. */
  env: string;
  /** Used when the env var is missing. */
  default?: T;
  /** Throws at startup (fail fast) when the env var is missing and has no default. */
  required?: boolean;
  /** Transforms the raw string env value, e.g. Number, JSON.parse. */
  parse?: (raw: string) => T;
}

export type ConfigSchema = Record<string, ConfigFieldSpec<unknown>>;

export type ConfigOf<S extends ConfigSchema> = { [K in keyof S]: S[K] extends ConfigFieldSpec<infer T> ? T : never };

/**
 * Generic env-backed config loader — no fixed schema, no project-specific
 * fields baked into the framework. Each project describes its own shape:
 *
 *   const config = createConfig({
 *     port: { env: "PORT", default: 3000, parse: Number },
 *     sessionSecret: { env: "SESSION_SECRET", required: true },
 *   });
 *
 * A required field missing from the environment throws immediately at boot
 * (fail fast) with a clear message, instead of surfacing as an obscure bug
 * later in a request.
 */
export function createConfig<S extends ConfigSchema>(schema: S): ConfigOf<S> {
  const result = {} as ConfigOf<S>;

  for (const key in schema) {
    const spec = schema[key];
    const raw = process.env[spec.env];

    if (raw === undefined) {
      if (spec.default !== undefined) {
        result[key] = spec.default as ConfigOf<S>[typeof key];
        continue;
      }
      if (spec.required) {
        throw new Error(`Missing required environment variable "${spec.env}"`);
      }
      result[key] = undefined as ConfigOf<S>[typeof key];
      continue;
    }

    result[key] = (spec.parse ? spec.parse(raw) : raw) as ConfigOf<S>[typeof key];
  }

  return result;
}
