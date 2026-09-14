const bcrypt = require("bcrypt");

const SALT_ROUNDS = 12;

/**
 * Concrete implementation of the `hasher` contract expected by auth.engine.js:
 *   hash(plain: string): Promise<string>
 *   verify(plain: string, hash: string): Promise<boolean>
 *
 * bcrypt fulfills the contract here; swap this module for another implementation
 * (argon2, scrypt...) without touching auth.engine.js.
 */
module.exports = {
  async hash(plain) {
    return bcrypt.hash(plain, SALT_ROUNDS);
  },

  async verify(plain, hash) {
    return bcrypt.compare(plain, hash);
  },
};
