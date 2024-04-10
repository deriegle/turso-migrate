#!/usr/bin/env node

import chalk from "chalk";
import { program } from "commander";
import { name, version } from "../package.json";
import { handleStatusCommand } from "./commands/status";
import { handleMigrateCommand } from "./commands/migrate";
import { handleCreateCommand } from "./commands/create";
import { handleResolveCommand } from "./commands/resolve";

program
  .name(name)
  .description("CLI tool to make migrations in Turso easier.")
  .version(version);

program
  .command("create")
  .description("Create a new migration file")
  .requiredOption("-f, --migrationsFolder <path>", "Path to migrations folder")
  .argument("[name]", "Name of the migration file")
  .action((name, options) =>
    handleCreateCommand({
      name,
      migrationsFolder: options.migrationsFolder,
    })
  );

program
  .command("migrate")
  .description("Migrates the database")
  .requiredOption("-d, --databaseUrl <databaseUrl>", "Turso Database URL")
  .requiredOption("-a, --databaseAuthToken <token>", "Turso DB Auth Token")
  .requiredOption("-f, --migrationsFolder <path>", "Path to migrations folder")
  .action(handleMigrateCommand);

program
  .command("resolve")
  .description(
    "Updates a migration file status. This can be useful to mark a migration as complete manually or pending if you want to run it again."
  )
  .requiredOption("-d, --databaseUrl <databaseUrl>", "Turso Database URL")
  .requiredOption("-a, --databaseAuthToken <token>", "Turso DB Auth Token")
  .requiredOption("-f, --migrationsFolder <path>", "Path to migrations folder")
  .option("--completed <migrationName>", "Migration to mark as completed")
  .option("--pending <migrationName>", "Migration to mark as pending")
  .action(handleResolveCommand);

program
  .command("status")
  .description("Shows the status of migrations")
  .requiredOption("-d, --databaseUrl <databaseUrl>", "Turso Database URL")
  .requiredOption("-a, --databaseAuthToken <token>", "Turso DB Auth Token")
  .requiredOption("-f, --migrationsFolder <path>", "Path to migrations folder")
  .action(handleStatusCommand);

void program.parseAsync(process.argv);

process.addListener("unhandledRejection", (error) => {
  console.error(chalk.red(`Encountered an error: ${error}`));
});

process.addListener("uncaughtException", (error) => {
  console.error(chalk.red(`Encountered an error: ${error}`));
});
