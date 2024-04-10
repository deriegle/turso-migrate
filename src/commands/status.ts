import chalk from "chalk";
import { getClient } from "../turso";
import { getMigrations } from "../getMigrations";
import { Table } from "console-table-printer";

export const handleStatusCommand = async ({
  databaseAuthToken,
  databaseUrl,
  migrationsFolder,
}: {
  databaseUrl: string;
  databaseAuthToken: string;
  migrationsFolder: string;
}) => {
  const clientResult = await getClient({ databaseAuthToken, databaseUrl });

  if (!clientResult.success) {
    console.log(chalk.red(clientResult.error));
    return;
  }

  const client = clientResult.value;

  const migrationsResult = await getMigrations({ client, migrationsFolder });

  if (!migrationsResult.success) {
    console.log(chalk.red(migrationsResult.error));
    return;
  }

  const table = new Table({
    columns: [
      { name: "name", alignment: "left", title: "Name" },
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
};
