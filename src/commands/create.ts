import chalk from "chalk";
import { stat, mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { faker } from "@faker-js/faker";
import { MIGRATION_FILE_NAME } from "../migrationsTable";

export const handleCreateCommand = async ({
  name,
  schemaFolder,
}: {
  name?: string;
  schemaFolder: string;
}) => {
  try {
    const stats = await stat(schemaFolder);

    if (!stats.isDirectory()) {
      console.error(
        chalk.red(
          `${schemaFolder} is not a directory and cannot be used for creating migrations.`
        )
      );
      return;
    }
  } catch (error) {
    console.error(chalk.red(`Could not find directory ${schemaFolder}`));
  }

  const migrationNameParts = [Date.now().toString()];

  if (name) {
    migrationNameParts.push(name);
  } else {
    migrationNameParts.push(
      faker.word.adjective(),
      faker.word.noun(),
      faker.word.verb()
    );
  }

  const migrationName = migrationNameParts
    .join("_")
    .replace("-", "_")
    .toLowerCase();

  const migrationFolderPath = join(schemaFolder, migrationName);
  const migrationFilePath = join(migrationFolderPath, MIGRATION_FILE_NAME);

  await mkdir(migrationFolderPath);
  await writeFile(migrationFilePath, "-- Enter your migration here.", "utf-8");

  console.log(chalk.green(`Created migration ${migrationFilePath}.`));
};
