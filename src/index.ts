import chalk from "chalk";
import { createHash } from "crypto";
import { Table } from "console-table-printer";
import { stat, readdir, readFile } from "fs/promises";
import { join } from "path";
import { program } from "commander";
import { version } from "../package.json";
import { Client as LibSQLClient, createClient } from "@libsql/client";
import { prompt } from "enquirer";
import { Result } from "./result";

const MIGRATIONS_TABLE = "__turso_migrations";

const migrationStatuses = ["pending", "errored", "completed"] as const;

type MigrationStatus = (typeof migrationStatuses)[number];

type Migration = {
  name: string;
  status: MigrationStatus;
  fileContents: string;
  path: string;
  sha: string;
  error?: string;
};

async function createPendingMigration({
  client,
  migration,
}: {
  client: LibSQLClient;
  migration: Migration;
}) {
  if (!(await hasMigrationsTable(client))) {
    await client.executeMultiple(`
      CREATE TABLE ${MIGRATIONS_TABLE} (
        name TEXT NOT NULL,
        sha TEXT NOT NULL,
        status TEXT NOT NULL,
        error TEXT,
        created TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE UNIQUE INDEX "${MIGRATIONS_TABLE}_name_unique" ON "${MIGRATIONS_TABLE}" ("name");
    `);
  }

  await client.execute(`
    INSERT INTO ${MIGRATIONS_TABLE} (name, sha, status) VALUES ('${migration.name}', '${migration.sha}', 'pending');
  `);
}

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

  const migrations: Omit<Migration, "error" | "status">[] = [];

  for (const file of files.value) {
    let fileContents: string;

    try {
      fileContents = await readFile(join(file.path, "up.sql"), "utf-8");
    } catch (error) {
      return Result.failure(
        `Failed to read migration file for migration ${file.name}`
      );
    }

    const sha = createHash("sha256").update(fileContents).digest("base64");

    migrations.push({
      fileContents,
      name: file.name,
      path: file.path,
      sha,
    });
  }

  if (!(await hasMigrationsTable(client))) {
    return Result.ok(migrations.map((m) => ({ ...m, status: "pending" })));
  }

  const result = await client.execute(
    `SELECT name, error, sha, status FROM ${MIGRATIONS_TABLE};`
  );

  const missingMigrations = result.rows.filter(
    (row) => !files.value.find((file) => file.name === row.name)
  );

  if (missingMigrations.length) {
    return Result.failure(
      `Some migrations have been ran but are missing from the schema folder:\n\n${missingMigrations.join(
        "\n"
      )}`
    );
  }

  const incorrectShas = result.rows.filter((row) => {
    const migration = migrations.find((m) => m.name === row.name);
    return migration!.sha !== row.sha;
  });

  if (incorrectShas.length) {
    return Result.failure(
      `Some migrations have been modified since they were ran. Please fix them first.\n\n${incorrectShas
        .map((r) => r.name)
        .join("\n")}`
    );
  }

  return Result.ok(
    migrations.map((migration) => {
      const migrationRow = result.rows.find(
        (row) => row.name === migration.name
      );

      return {
        ...migration,
        status: migrationStatuses.includes(migrationRow?.status as any)
          ? (migrationRow!.status as MigrationStatus)
          : "pending",
        error:
          typeof migrationRow?.error === "string"
            ? migrationRow.error
            : undefined,
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

    const contents = await readFile(
      join(firstPendingMigration.path, "up.sql"),
      "utf-8"
    );

    await createPendingMigration({
      client,
      migration: firstPendingMigration,
    });

    try {
      await client.executeMultiple(contents);

      await client.execute(
        `UPDATE ${MIGRATIONS_TABLE} SET status = 'completed' WHERE name = '${firstPendingMigration.name}'`
      );

      console.log(
        chalk.green(`Migration ${firstPendingMigration.name} succeeded! 🎉`)
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : `${error}`;

      await client.execute(
        `UPDATE ${MIGRATIONS_TABLE} SET status = 'errored', error = '${errorMessage}' WHERE name = '${firstPendingMigration.name}'`
      );

      console.log(
        chalk.red(
          `Migration ${firstPendingMigration.name} failed: ${errorMessage}.`
        )
      );
      return;
    }
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

    const contents = await readFile(
      join(lastErroredMigration.path, "up.sql"),
      "utf-8"
    );

    try {
      await client.executeMultiple(contents);

      await client.execute(
        `UPDATE ${MIGRATIONS_TABLE} SET status = 'completed', error = NULL WHERE name = '${lastErroredMigration.name}'`
      );

      console.log(
        chalk.green(`Migration ${lastErroredMigration.name} succeeded! 🎉`)
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : `${error}`;

      await client.execute(
        `UPDATE ${MIGRATIONS_TABLE} SET status = 'errored', error = '${errorMessage}' WHERE name = '${lastErroredMigration.name}'`
      );

      console.log(
        chalk.red(
          `Migration ${lastErroredMigration.name} failed: ${errorMessage}.`
        )
      );
      return;
    }
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
