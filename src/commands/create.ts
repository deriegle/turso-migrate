import chalk from "chalk";
import { stat, mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { faker } from "@faker-js/faker";
import { MIGRATION_FILE_NAME } from "../migrationsTable";

export const handleCreateCommand = async ({
  name,
  migrationsFolder,
}: {
  name?: string;
  migrationsFolder: string;
}) => {
  try {
    const stats = await stat(migrationsFolder);

    if (!stats.isDirectory()) {
      console.error(
        chalk.red(
          `${migrationsFolder} is not a directory and cannot be used for creating migrations.`
        )
      );
      return;
    }
  } catch (error) {
    console.error(chalk.red(`Could not find directory ${migrationsFolder}`));
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

  const migrationFolderPath = join(migrationsFolder, migrationName);
  const migrationFilePath = join(migrationFolderPath, MIGRATION_FILE_NAME);

  await mkdir(migrationFolderPath);
  await writeFile(migrationFilePath, "-- Enter your migration here.", "utf-8");

  console.log(chalk.green(`Created migration ${migrationFilePath}.`));
};
