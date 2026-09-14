import * as fs from "node:fs";
import * as path from "node:path";
import { Command, Args, Flags } from "@oclif/core";

interface TemplateFile {
  suffix: string;
  content: (name: string) => string;
}

const FILES: TemplateFile[] = [
  {
    suffix: "route.js",
    content: () => `const router = require("express").Router();

module.exports = router;
`,
  },
  {
    suffix: "engine.js",
    content: (name) => `module.exports = {
  name: "${name}",
};
`,
  },
  {
    suffix: "lang.js",
    content: () => `module.exports = {
  en: {},
  fr: {},
};
`,
  },
  {
    suffix: "middleware.js",
    content: () => `module.exports = function middleware(req, res, next) {
  next();
};
`,
  },
  {
    suffix: "test.js",
    content: (name) => `describe("${name} engine", () => {
  it.todo("add tests for ${name}");
});
`,
  },
];

export default class MakeEngineCommand extends Command {
  static description =
    "Scaffold a new engine (feature): route, engine, lang, middleware and test files.";

  static args = {
    name: Args.string({ required: true, description: "Feature name, e.g. 'chess'" }),
  };

  static flags = {
    dir: Flags.string({
      description: "Root features directory",
      default: "features",
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(MakeEngineCommand);
    const featureDir = path.join(process.cwd(), flags.dir, args.name);

    if (fs.existsSync(featureDir)) {
      this.error(`"${featureDir}" already exists.`);
    }

    fs.mkdirSync(featureDir, { recursive: true });

    for (const file of FILES) {
      const filePath = path.join(featureDir, `${args.name}.${file.suffix}`);
      fs.writeFileSync(filePath, file.content(args.name));
      this.log(`created ${path.relative(process.cwd(), filePath)}`);
    }
  }
}
