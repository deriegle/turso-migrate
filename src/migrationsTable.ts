import { Client as LibSQLClient } from "@libsql/client";
import { Migration, MigrationStatus } from "./migration";
import chalk from "chalk";

const MIGRATIONS_TABLE = "__turso_migrations";

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

async function markMigrationErrored({
  client,
  migration,
  error,
}: {
  client: LibSQLClient;
  migration: Migration;
  error: string;
}) {
  await client.execute(`
    UPDATE ${MIGRATIONS_TABLE} SET status = 'errored', error = '${error}' WHERE name = '${migration.name}';
  `);
}

async function markMigrationCompleted({
  client,
  migration,
}: {
  client: LibSQLClient;
  migration: Migration;
}) {
  await client.execute(`
    UPDATE ${MIGRATIONS_TABLE} SET status = 'completed' WHERE name = '${migration.name}';
  `);
}

export async function executeMigration({
  client,
  migration,
  shouldCreatePendingMigration,
}: {
  client: LibSQLClient;
  migration: Migration;
  shouldCreatePendingMigration: boolean;
}) {
  if (shouldCreatePendingMigration) {
    await createPendingMigration({ client, migration });
  }

  try {
    await client.executeMultiple(migration.fileContents);
    await markMigrationCompleted({ client, migration });
    console.log(chalk.green(`Migration ${migration.name} succeeded! 🎉`));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : `${error}`;
    await markMigrationErrored({
      client,
      error: errorMessage,
      migration,
    });

    console.log(
      chalk.red(`Migration ${migration.name} failed: ${errorMessage}`)
    );
  }
}

export async function hasMigrationsTable(
  client: LibSQLClient
): Promise<boolean> {
  const result = await client.execute(
    `SELECT name FROM sqlite_master where type='table'`
  );

  return result.rows.some((row) => row.name === MIGRATIONS_TABLE);
}

type MigrationRow = {
  name: string;
  error?: string;
  sha: string;
  status: MigrationStatus;
  length: number;
};

export async function getMigrationRows(
  client: LibSQLClient
): Promise<MigrationRow[]> {
  const result = await client.execute(
    `SELECT name, error, sha, status FROM ${MIGRATIONS_TABLE};`
  );

  return result.rows.filter((row): row is MigrationRow => true);
}
