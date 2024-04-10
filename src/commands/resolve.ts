import chalk from "chalk";
import { getClient } from "../turso";
import { getMigrations } from "../getMigrations";
import { MigrationStatus } from "../migration";
import { updateMigrationStatus } from "../migrationsTable";

type SharedOptions<Options> = Options & {
  databaseAuthToken: string;
  databaseUrl: string;
  schemaFolder: string;
};

export const handleResolveCommand = async ({
  completed,
  databaseAuthToken,
  databaseUrl,
  pending,
  schemaFolder,
}:
  | SharedOptions<{ completed: string; pending?: string }>
  | SharedOptions<{ completed?: string; pending: string }>) => {
  if (!completed && !pending) {
    console.log(chalk.red("You must provide either --completed or --pending"));
    return;
  }

  const migrationName = completed || pending;
  const updatedStatus: MigrationStatus = completed ? "completed" : "pending";

  const clientResult = await getClient({ databaseAuthToken, databaseUrl });

  if (!clientResult.success) {
    console.log(chalk.red(clientResult.error));
    return;
  }

  const client = clientResult.value;

  const migrationsResult = await getMigrations({ client, schemaFolder });

  if (!migrationsResult.success) {
    console.log(chalk.red(migrationsResult.error));
    return;
  }

  const migration = migrationsResult.value.find(
    (m) => m.name === migrationName
  );

  if (!migration) {
    console.log(
      chalk.red(`Could not find migration with name ${migrationName}`)
    );

    return;
  }

  await updateMigrationStatus({
    client,
    migration,
    updatedStatus,
  });

  console.log(
    chalk.green(
      `Migration ${chalk.bold(migrationName)} marked as ${
        updatedStatus === "completed"
          ? chalk.green(updatedStatus)
          : chalk.yellow("pending")
      }`
    )
  );
};
