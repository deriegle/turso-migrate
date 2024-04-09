import chalk from "chalk";
import { program } from "commander";
import { prompt } from "enquirer";
import { version } from "../package.json";

program
  .name("turso-migrate")
  .description("CLI tool to make migrations in Turso easier.")
  .version(version);

program
  .version(version)
  .command("status")
  .description("Shows the status of migrations")
  .action(() => {});
