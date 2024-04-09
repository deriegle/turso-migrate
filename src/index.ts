import chalk from "chalk";
import { Table } from "console-table-printer";
import { program } from "commander";
import { version } from "../package.json";
import { Client as LibSQLClient, createClient } from "@libsql/client";
import { prompt } from "enquirer";
import { Result } from "./result";
import { getMigrations } from "./getMigrations";
import { executeMigration } from "./migrationsTable";

async function getClient({
  databaseAuthToken,
  databaseUrl,
}: {
  databaseAuthToken: string;
  databaseUrl: string;
}): Promise<Result<LibSQLClient>> {
  if (!databaseUrl.startsWith("libsql://")) {
    return Result.failure("Invalid database URL. Must start with libsql://");
  }

  const client = createClient({
    authToken: databaseAuthToken,
    url: databaseUrl,
  });

  return client
    .execute("SELECT 1")
    .then(() => Result.ok(client))
    .catch((err) =>
      Result.failure(
        `${err} Could not connect to the database. Please check your credentials.`
      )
    );
}

program
  .name("turso-migrate")
  .description("CLI tool to make migrations in Turso easier.")
  .version(version);

program
  .command("migrate")
  .description("Migrate the database")
  .requiredOption("-d, --databaseUrl <databaseUrl>", "Turso Database URL")
  .requiredOption(
    "-a, --databaseAuthToken <authToken>",
    "Turso Database Auth Token"
  )
  .requiredOption("-s, --schemaFolder <schema>", "Path to schema to migrate")
  .action(async (options) => {
    const clientResult = await getClient(options);

    if (!clientResult.success) {
      console.log(chalk.red(clientResult.error));
      return;
    }

    const client = clientResult.value;

    const migrationsResult = await getMigrations({
      client,
      schemaFolder: options.schemaFolder,
    });

    if (!migrationsResult.success) {
      console.log(chalk.red(migrationsResult.error));
      return;
    }

    const erroredMigrations = migrationsResult.value.filter(
      (migration) => migration.status === "errored"
    );

    if (erroredMigrations.length) {
      console.log(
        chalk.red(
          `Some migrations have errored and need to be fixed first:\n\n${erroredMigrations
            .map((m) => m.name)
            .join("\n")}`
        )
      );
      return;
    }

    const firstPendingMigration = migrationsResult.value.find(
      (m) => m.status === "pending"
    );

    if (!firstPendingMigration) {
      console.log(chalk.green("All migrations have been ran. Nothing to do."));
      return;
    }

    const result = await prompt<{ continue: boolean }>([
      {
        type: "confirm",
        name: "continue",
        message: `Migrate ${firstPendingMigration.name}?`,
      },
    ]);

    if (!result.continue) {
      return;
    }

    await executeMigration({
      client,
      migration: firstPendingMigration,
      shouldCreatePendingMigration: true,
    });
  });

program
  .command("retry")
  .description("Retry last errored migration")
  .requiredOption("-d, --databaseUrl <databaseUrl>", "Turso Database URL")
  .requiredOption(
    "-a, --databaseAuthToken <authToken>",
    "Turso Database Auth Token"
  )
  .requiredOption("-s, --schemaFolder <schema>", "Path to schema to migrate")
  .action(async (options) => {
    const clientResult = await getClient(options);

    if (!clientResult.success) {
      console.log(chalk.red(clientResult.error));
      return;
    }

    const client = clientResult.value;

    const migrationsResult = await getMigrations({
      client,
      schemaFolder: options.schemaFolder,
    });

    if (!migrationsResult.success) {
      console.log(chalk.red(migrationsResult.error));
      return;
    }

    const lastErroredMigration = migrationsResult.value.find(
      (migration) => migration.status === "errored"
    );

    if (!lastErroredMigration) {
      console.log(chalk.green("There are no errored migrations currently."));
      return;
    }

    const result = await prompt<{ continue: boolean }>([
      {
        type: "confirm",
        name: "continue",
        message: `Migrate ${lastErroredMigration.name}?`,
      },
    ]);

    if (!result.continue) {
      return;
    }

    await executeMigration({
      client,
      migration: lastErroredMigration,
      shouldCreatePendingMigration: false,
    });
  });

program
  .command("status")
  .description("Shows the status of migrations")
  .requiredOption("-d, --databaseUrl <databaseUrl>", "Turso Database URL")
  .requiredOption(
    "-a, --databaseAuthToken <authToken>",
    "Turso Database Auth Token"
  )
  .requiredOption("-s, --schemaFolder <schema>", "Path to schema to migrate")
  .action(async (options) => {
    const clientResult = await getClient(options);

    if (!clientResult.success) {
      console.log(chalk.red(clientResult.error));
      return;
    }

    const client = clientResult.value;

    const migrationsResult = await getMigrations({
      client,
      schemaFolder: options.schemaFolder,
    });

    if (!migrationsResult.success) {
      console.log(chalk.red(migrationsResult.error));
      return;
    }

    const table = new Table({
      columns: [
        { name: "name", alignment: "center", title: "Name" },
        { name: "status", alignment: "center", title: "Status" },
        { name: "error", alignment: "center", title: "Error" },
      ],
      enabledColumns: migrationsResult.value.find((m) => m.status === "errored")
        ? ["name", "status", "error"]
        : ["name", "status"],
      rows: migrationsResult.value.map((migration) => ({
        ...migration,
        status:
          migration.status === "pending"
            ? chalk.yellow(migration.status)
            : migration.status === "errored"
            ? chalk.red(migration.status)
            : chalk.green(migration.status),
      })),
    });

    table.printTable();
  });

void program.parseAsync(process.argv);
