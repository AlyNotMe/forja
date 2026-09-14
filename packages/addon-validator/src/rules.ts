const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type Rule = (fieldValue: unknown, ruleOption: unknown) => boolean;

// Each rule receives (fieldValue, ruleOption) and returns true when valid.
export const rules: Record<string, Rule> = {
  required(fieldValue) {
    return fieldValue !== undefined && fieldValue !== null && fieldValue !== "";
  },

  isAlphanumeric(fieldValue) {
    const matches = String(fieldValue).match(/[A-Za-z0-9]+|_+|-+/gm);
    return matches?.join("") === String(fieldValue);
  },

  isEmail(fieldValue) {
    return EMAIL_RE.test(String(fieldValue));
  },

  min(fieldValue, minLength) {
    return String(fieldValue).length >= (minLength as number);
  },

  max(fieldValue, maxLength) {
    return String(fieldValue).length <= (maxLength as number);
  },
};
