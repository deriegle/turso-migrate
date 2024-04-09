import chalk from "chalk";
import { getClient } from "../turso";
import { getMigrations } from "../getMigrations";
import { prompt } from "enquirer";
import { executeMigration } from "../migrationsTable";

export const handleRetryCommand = async (options: {
  databaseUrl: string;
  databaseAuthToken: string;
  schemaFolder: string;
}) => {
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
};
