import { createHash } from "crypto";
import { stat, readdir, readFile } from "fs/promises";
import { join } from "path";
import { Client as LibSQLClient } from "@libsql/client";
import { Result } from "./result";
import { Migration } from "./migration";
import {
  MIGRATION_FILE_NAME,
  getMigrationRows,
  hasMigrationsTable,
} from "./migrationsTable";

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

export async function getMigrations({
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
      fileContents = await readFile(
        join(file.path, MIGRATION_FILE_NAME),
        "utf-8"
      );
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

  const result = await getMigrationRows(client);

  const missingMigrations = result.filter(
    (row) => !files.value.find((file) => file.name === row.name)
  );

  if (missingMigrations.length) {
    return Result.failure(
      `Some migrations have been ran but are missing from the schema folder:\n\n${missingMigrations
        .map((m) => m.name)
        .join("\n")}`
    );
  }

  const incorrectShas = result.filter((row) => {
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
      const migrationRow = result.find((row) => row.name === migration.name);

      return {
        ...migration,
        status: migrationRow?.status ?? "pending",
        error: migrationRow?.error,
      };
    })
  );
}
