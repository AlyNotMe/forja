import { Command, Args } from "@oclif/core";

export default class NewCommand extends Command {
  static description = "Scaffold a new Forja project (asks stack questions).";

  static args = {
    name: Args.string({ required: true, description: "Project directory name" }),
  };

  async run(): Promise<void> {
    const { args } = await this.parse(NewCommand);
    this.warn(
      `"forja new ${args.name}" is not implemented yet — stack prompts (language, ` +
        "view engine, frontend, styling, tests, addons) are still to be built."
    );
  }
}
