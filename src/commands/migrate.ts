import chalk from "chalk";
import { getMigrations } from "../getMigrations";
import { executeMigration } from "../migrationsTable";
import { getClient } from "../turso";
import { prompt } from "enquirer";

export async function handleMigrateCommand(options: {
  databaseUrl: string;
  databaseAuthToken: string;
  schemaFolder: string;
}): Promise<void> {
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
}
