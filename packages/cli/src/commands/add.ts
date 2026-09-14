import { Command, Args } from "@oclif/core";

const OFFICIAL_PRESETS = ["auth", "orm", "realtime", "i18n"] as const;

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
    this.warn(
      `"forja add ${args.preset}" is not implemented yet — installing @forja/` +
        `addon-${args.preset} and copying its templates into features/ is still to be built.`
    );
  }
}
