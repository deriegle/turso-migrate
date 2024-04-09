import chalk from "chalk";
import { getClient } from "../turso";
import { getMigrations } from "../getMigrations";
import { Table } from "console-table-printer";

export const handleStatusCommand = async (options: {
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
};
