import chalk from "chalk";
import { Table } from "console-table-printer";
import { stat, readdir } from "fs/promises";
import { join } from "path";
import { program } from "commander";
import { version } from "../package.json";
import { Client as LibSQLClient, createClient } from "@libsql/client";
import { Result } from "./result";

const MIGRATIONS_TABLE = "__turso_migrations";

const migrationStatuses = ["pending", "errored", "completed"] as const;

type MigrationStatus = (typeof migrationStatuses)[number];

type Migration = {
  name: string;
  path: string;
  status: MigrationStatus;
  error?: string;
};

async function hasMigrationsTable(client: LibSQLClient): Promise<boolean> {
  const result = await client.execute(
    `SELECT name FROM sqlite_master where type='table'`
  );

  return result.rows.some((row) => row.name === MIGRATIONS_TABLE);
}

async function getMigrations({
  client,
  schemaFolder,
}: {
  client: LibSQLClient;
  schemaFolder: string;
}): Promise<Result<Migration[]>> {
  const files = await getMigrationFiles(schemaFolder);

  if (!files.success) {
    return files;
  }

  if (!(await hasMigrationsTable(client))) {
    return Result.ok(
      files.value.map((file) => ({
        name: file.name,
        path: file.path,
        status: "pending",
      }))
    );
  }

  const result = await client.execute(
    `SELECT name, error, status FROM ${MIGRATIONS_TABLE};`
  );

  const missingMigrations = result.rows.filter(
    (migration) => !files.value.find((file) => file.name === migration.name)
  );

  if (missingMigrations.length) {
    return Result.failure(
      `Some migrations have been ran but are missing from the schema folder:\n\n${missingMigrations.join(
        "\n"
      )}`
    );
  }

  return Result.ok(
    files.value.map((file) => {
      const migration = result.rows.find((row) => row.name === file.name);

      return {
        name: file.name,
        path: file.path,
        status: migrationStatuses.includes(migration?.status as any)
          ? (migration!.status as MigrationStatus)
          : "pending",
        error:
          typeof migration?.error === "string" ? migration.error : undefined,
      };
    })
  );
}

async function getMigrationFiles(
  schemaFolder: string
): Promise<Result<Array<{ name: string; path: string }>>> {
  try {
    const stats = await stat(schemaFolder);

    if (!stats.isDirectory()) {
      return Result.failure(`${schemaFolder} is not a directory.`);
    }
  } catch (error) {
    Result.failure(`Failed to verify ${schemaFolder}`);
  }

  const folderContents = await readdir(schemaFolder, {
    withFileTypes: true,
  });

  return Result.ok(
    folderContents
      .filter((file) => file.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((file) => ({ name: file.name, path: join(file.path, file.name) }))
  );
}

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

    console.log(chalk.green("Migrating..."));
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
      ],
      enabledColumns: ["name", "status"],
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
