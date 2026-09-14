import type { Request, Response, NextFunction } from "express";
import { rules } from "./rules";

export type Schema = Record<string, Record<string, unknown>>;
export type ValidationErrors = Record<string, string[]>;

/**
 * Validate `data` against a `schema` of { field: { ruleName: ruleOption, ... } }.
 * Returns { field: ["ruleName", ...] } for failed rules only — empty object means valid.
 *
 * Example:
 *   validate({ email: "a@b.com", password: "x" }, {
 *     email: { required: true, isEmail: true },
 *     password: { required: true, min: 8 },
 *   });
 *   // => { password: ["min"] }
 */
export function validate(data: Record<string, unknown> | undefined, schema: Schema): ValidationErrors {
  const errors: ValidationErrors = {};

  for (const field in schema) {
    const fieldRules = schema[field];
    const fieldValue = data?.[field];
    const failed: string[] = [];

    for (const ruleName in fieldRules) {
      const ruleOption = fieldRules[ruleName];
      if (ruleOption === false) continue;

      const rule = rules[ruleName];
      if (!rule) throw new Error(`Unknown validation rule "${ruleName}"`);

      // required must run even on empty values; other rules skip empty optional fields.
      const isEmpty = fieldValue === undefined || fieldValue === null || fieldValue === "";
      if (isEmpty && ruleName !== "required") continue;

      if (!rule(fieldValue, ruleOption)) {
        failed.push(ruleName);
      }
    }

    if (failed.length > 0) errors[field] = failed;
  }

  return errors;
}

// Express middleware factory: 400s with { errors } when req.body fails the schema.
export function validateBody(schema: Schema) {
  return function (req: Request, res: Response, next: NextFunction) {
    const errors = validate(req.body, schema);
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ errors });
    }
    next();
  };
}

export { rules };
