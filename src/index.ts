import { program } from "commander";
import { version } from "../package.json";
import { handleStatusCommand } from "./commands/status";
import { handleRetryCommand } from "./commands/retry";
import { handleMigrateCommand } from "./commands/migrate";
import { handleCreateCommand } from "./commands/create";

program
  .name("turso-migrate")
  .description("CLI tool to make migrations in Turso easier.")
  .version(version);

program
  .command("create")
  .description("Create a new migration file")
  .requiredOption("-s, --schemaFolder <schema>", "Path to schema folder")
  .action(handleCreateCommand);

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
  .command("retry")
  .description("Retry last errored migration")
  .requiredOption("-d, --databaseUrl <databaseUrl>", "Turso Database URL")
  .requiredOption(
    "-a, --databaseAuthToken <authToken>",
    "Turso Database Auth Token"
  )
  .requiredOption("-s, --schemaFolder <schema>", "Path to schema to migrate")
  .action(handleRetryCommand);

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
