import chalk from "chalk";
import { program } from "commander";
import { prompt } from "enquirer";
import { version } from "../package.json";

// support multiple schemas but not necessarily immediately

program
  .name("turso-migrate")
  .description("CLI tool to make migrations in Turso easier.")
  .version(version)
  .command("status")
  .description("Shows the status of migrations")
  .action(() => {
    console.log(chalk.green("Hello world"));
  });

program.parse(process.argv);
