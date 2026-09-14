module.exports = {
  test: {
    include: ["features/**/*.test.js"],
    // Matches Jest's ergonomics: describe/it/expect available without importing
    // them in every test file.
    globals: true,
  },
};
