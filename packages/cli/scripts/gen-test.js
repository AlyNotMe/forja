// Dev-only utility (not published — excluded by package.json's "files").
// Regenerates every lang x render test project under dev/test/, wiring
// @forja/core via a manual symlink (npm link is broken under Volta here)
// since it isn't published to a registry.
//
// Usage: node scripts/gen-test.js [testDir]
const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");
const { copyLayer, mergeFragment } = require("../dist/scaffold");

const TEMPLATES_DIR = path.join(__dirname, "..", "templates");
const CORE_DIR = path.join(__dirname, "..", "..", "core");
const TEST_DIR = process.argv[2] || path.join(__dirname, "..", "..", "..", "..", "test");

const RENDERS = ["ejs", "pug", "handlebars", "react", "vue", "svelte", "none"];
const LANGS = ["js", "ts"];

function generate(targetDir, { lang, render, css, tests }) {
  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.mkdirSync(targetDir, { recursive: true });
  const layers = [
    path.join(TEMPLATES_DIR, "base"),
    path.join(TEMPLATES_DIR, "lang", lang),
    path.join(TEMPLATES_DIR, "render", render),
    path.join(TEMPLATES_DIR, "css", css),
    path.join(TEMPLATES_DIR, "tests", tests),
  ];
  let pkg = { name: path.basename(targetDir) };
  for (const layer of layers) {
    copyLayer(layer, targetDir);
    pkg = mergeFragment(pkg, layer);
  }
  // @forja/core isn't published to a registry — strip it before `npm install`
  // and wire it back in via a manual symlink instead.
  delete pkg.dependencies["@forja/core"];
  fs.writeFileSync(path.join(targetDir, "package.json"), JSON.stringify(pkg, null, 2) + "\n");
}

function linkCore(targetDir) {
  const scope = path.join(targetDir, "node_modules", "@forja");
  fs.mkdirSync(scope, { recursive: true });
  const link = path.join(scope, "core");
  fs.rmSync(link, { force: true });
  fs.symlinkSync(CORE_DIR, link, "dir");
}

for (const lang of LANGS) {
  for (const render of RENDERS) {
    const name = `${lang}-${render}`;
    const targetDir = path.join(TEST_DIR, name);
    console.log(`\n=== ${name} ===`);

    generate(targetDir, { lang, render, css: "scss", tests: "vitest" });
    execSync("npm install --no-audit --no-fund", { cwd: targetDir, stdio: "inherit" });
    linkCore(targetDir);

    if (lang === "ts") {
      execSync("npx tsc", { cwd: targetDir, stdio: "inherit" });
    }

    if (["react", "vue", "svelte"].includes(render)) {
      execSync("npm install --no-audit --no-fund", { cwd: path.join(targetDir, "client"), stdio: "inherit" });
    }
  }
}

console.log(`\nDone — ${LANGS.length * RENDERS.length} projects generated in ${TEST_DIR}`);
