import * as fs from "node:fs";
import * as path from "node:path";
import { Command, Args } from "@oclif/core";
import { copyLayer } from "../scaffold";

const OFFICIAL_PRESETS = ["auth", "orm", "realtime", "i18n"] as const;
type Preset = (typeof OFFICIAL_PRESETS)[number];

const PACKAGE_NAME: Record<Preset, string> = {
  auth: "@forjajs/addon-auth",
  orm: "@forjajs/orm",
  realtime: "@forjajs/addon-realtime",
  i18n: "@forjajs/addon-i18n",
};

interface JsonObject {
  [key: string]: unknown;
}

export default class AddCommand extends Command {
  static description = "Plug an official Forja addon/preset into the current project.";

  static args = {
    preset: Args.string({
      required: true,
      description: `Addon to add (${OFFICIAL_PRESETS.join(", ")})`,
      options: OFFICIAL_PRESETS as unknown as string[],
    }),
  };

  async run(): Promise<void> {
    const { args } = await this.parse(AddCommand);
    const preset = args.preset as Preset;
    const packageName = PACKAGE_NAME[preset];

    const cwd = process.cwd();
    const targetPackageJsonPath = path.join(cwd, "package.json");
    if (!fs.existsSync(targetPackageJsonPath)) {
      this.error(`No package.json found in "${cwd}" — run this inside a Forja project.`);
    }

    // Locate the addon package on disk (installed dependency of @forjajs/cli).
    let addonPackageJsonPath: string;
    try {
      addonPackageJsonPath = require.resolve(`${packageName}/package.json`);
    } catch {
      this.error(`Could not resolve "${packageName}". Is it installed alongside @forjajs/cli?`);
    }
    const addonDir = path.dirname(addonPackageJsonPath);
    const templatesDir = path.join(addonDir, "templates");

    if (!fs.existsSync(templatesDir)) {
      this.warn(
        `"forja add ${preset}" has no templates yet — ${packageName} is still an empty ` +
          "package under construction."
      );
      return;
    }

    const targetFeatureDir = path.join(cwd, "features", preset);
    if (fs.existsSync(targetFeatureDir)) {
      this.error(`"${targetFeatureDir}" already exists.`);
    }

    fs.mkdirSync(targetFeatureDir, { recursive: true });
    copyLayer(templatesDir, targetFeatureDir);

    const addonPackageJson = JSON.parse(fs.readFileSync(addonPackageJsonPath, "utf8")) as JsonObject;
    const peerDependencies = (addonPackageJson.peerDependencies as JsonObject) ?? {};

    const targetPackageJson = JSON.parse(fs.readFileSync(targetPackageJsonPath, "utf8")) as JsonObject;
    const dependencies = (targetPackageJson.dependencies as JsonObject) ?? {};

    dependencies[packageName] = "*";
    for (const dep of Object.keys(peerDependencies)) {
      if (!(dep in dependencies)) dependencies[dep] = "*";
    }

    targetPackageJson.dependencies = dependencies;
    fs.writeFileSync(targetPackageJsonPath, JSON.stringify(targetPackageJson, null, 2) + "\n");

    this.log(`Added "${preset}" to features/${preset}/`);
    this.log(`Updated dependencies: ${[packageName, ...Object.keys(peerDependencies)].join(", ")}`);
    this.log("Run your package manager's install command to fetch them.");
  }
}
