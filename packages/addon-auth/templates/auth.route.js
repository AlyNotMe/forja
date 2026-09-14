const router = require("express").Router();
const { validateBody } = require("@forja/addon-validator");
const { createAuthEngine } = require("./auth.engine");
const hasher = require("./auth.password");

// TODO: replace with the in-house ORM's users repository once @forja/orm exists.
// Must fulfill the Repository contract from @forja/core (findById/findOne/create/
// update/delete) — swap this stub for @forja/orm's repository without touching
// auth.engine.js.
const users = {
  async findById(id) {
    return null;
  },
  async findOne(criteria) {
    return null;
  },
  async create(data) {
    return data;
  },
  async update(id, data) {
    return data;
  },
  async delete(id) {},
};

const engine = createAuthEngine({ hasher, users });

const registerSchema = {
  email: { required: true, isEmail: true },
  password: { required: true, min: 8, max: 72 },
};

const loginSchema = {
  email: { required: true, isEmail: true },
  password: { required: true },
};

router.post("/register", validateBody(registerSchema), async (req, res) => {
  const user = await engine.registerUser(req.body);
  res.status(201).json(user);
});

router.post("/login", validateBody(loginSchema), async (req, res) => {
  const user = await engine.authenticateUser(req.body);
  if (!user) return res.status(401).json({ error: "invalid_credentials" });
  res.json(user);
});

module.exports = router;
