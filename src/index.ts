import { program } from "commander";
import { version } from "../package.json";
import { handleStatusCommand } from "./commands/status";
import { handleMigrateCommand } from "./commands/migrate";
import { handleCreateCommand } from "./commands/create";
import { handleResolveCommand } from "./commands/resolve";

program
  .name("turso-migrate")
  .description("CLI tool to make migrations in Turso easier.")
  .version(version);

program
  .command("create")
  .description("Create a new migration file")
  .requiredOption("-s, --schemaFolder <schema>", "Path to schema folder")
  .argument("[name]", "Name of the migration file")
  .action((name, options) =>
    handleCreateCommand({
      name,
      schemaFolder: options.schemaFolder,
    })
  );

program
  .command("migrate")
  .description("Migrate the database")
  .requiredOption("-d, --databaseUrl <databaseUrl>", "Turso Database URL")
  .requiredOption(
    "-a, --databaseAuthToken <authToken>",
    "Turso Database Auth Token"
  )
  .requiredOption("-s, --schemaFolder <schema>", "Path to schema to migrate")
  .action(handleMigrateCommand);

program
  .command("resolve")
  .description("Updates a migration file status")
  .requiredOption("-d, --databaseUrl <databaseUrl>", "Turso Database URL")
  .requiredOption(
    "-a, --databaseAuthToken <authToken>",
    "Turso Database Auth Token"
  )
  .requiredOption("-s, --schemaFolder <schema>", "Path to schema folder")
  .option("--completed <migrationName>", "Migration to mark as completed")
  .option("--pending <migrationName>", "Migration to mark as pending")
  .argument("[name]", "Name of the migration file")
  .action(handleResolveCommand);

program
  .command("status")
  .description("Shows the status of migrations")
  .requiredOption("-d, --databaseUrl <databaseUrl>", "Turso Database URL")
  .requiredOption(
    "-a, --databaseAuthToken <authToken>",
    "Turso Database Auth Token"
  )
  .requiredOption("-s, --schemaFolder <schema>", "Path to schema to migrate")
  .action(handleStatusCommand);

void program.parseAsync(process.argv);
