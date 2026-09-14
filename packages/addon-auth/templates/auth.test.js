const { createAuthEngine } = require("./auth.engine");

// Fake implementations of the hasher/users contracts — no bcrypt, no real DB.
// This is the point of injecting contracts instead of concrete dependencies.
function createEngine({ existingUser } = {}) {
  const hasher = {
    async hash(plain) {
      return `hashed:${plain}`;
    },
    async verify(plain, hash) {
      return hash === `hashed:${plain}`;
    },
  };

  const users = {
    async findById(id) {
      return existingUser?.id === id ? existingUser : null;
    },
    async findOne(criteria) {
      return existingUser?.email === criteria.email ? existingUser : null;
    },
    async create(data) {
      return { ...data };
    },
    async update(id, data) {
      return { ...existingUser, ...data };
    },
    async delete(id) {},
  };

  return createAuthEngine({ hasher, users });
}

describe("auth engine", () => {
  it("registers a user with a hashed password", async () => {
    const engine = createEngine();
    const user = await engine.registerUser({ email: "a@b.com", password: "secret" });
    expect(user.passwordHash).toBe("hashed:secret");
  });

  it("authenticates a user with valid credentials", async () => {
    const engine = createEngine({
      existingUser: { email: "a@b.com", passwordHash: "hashed:secret" },
    });
    const user = await engine.authenticateUser({ email: "a@b.com", password: "secret" });
    expect(user).not.toBeNull();
  });

  it("rejects authentication for an unknown user", async () => {
    const engine = createEngine();
    const user = await engine.authenticateUser({ email: "nobody@b.com", password: "wrong" });
    expect(user).toBeNull();
  });
});
