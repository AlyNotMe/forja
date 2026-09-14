const { contracts } = require("@forja/core");

/**
 * Auth engine: knows nothing about bcrypt, the database, or any concrete stack
 * choice. It only depends on two contracts from @forja/core, injected by whoever
 * wires the route (the composition root, see auth.route.js):
 *
 *   hasher: Hasher contract     (hash/verify)
 *   users:  Repository contract (findOne/create/...)
 *
 * Any implementation that fulfills these contracts can be swapped in — bcrypt or
 * argon2 for the hasher, the in-house ORM or a plain in-memory store for `users` —
 * without ever touching this file.
 */
function createAuthEngine({ hasher, users }) {
  contracts.assertImplements("Hasher", hasher, contracts.HASHER_METHODS);
  contracts.assertImplements("Repository", users, contracts.REPOSITORY_METHODS);

  return {
    name: "auth",

    async registerUser({ email, password }) {
      // input already validated upstream by auth.route.js (validateBody)
      const passwordHash = await hasher.hash(password);
      return users.create({ email, passwordHash });
    },

    async authenticateUser({ email, password }) {
      const user = await users.findOne({ email });
      if (!user) return null;

      const valid = await hasher.verify(password, user.passwordHash);
      return (valid && user) || null;
    },
  };
}

module.exports = { createAuthEngine };
