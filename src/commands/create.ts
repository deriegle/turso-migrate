import chalk from "chalk";
import { stat, mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { faker } from "@faker-js/faker";

export const handleCreateCommand = async ({
  schemaFolder,
}: {
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

  const migrationName = [
    Date.now(),
    faker.word.adjective(),
    faker.word.noun(),
    faker.word.verb(),
  ]
    .join("_")
    .replace("-", "_")
    .toLowerCase();

  const migrationFolderPath = join(schemaFolder, migrationName);
  const migrationFilePath = join(migrationFolderPath, "up.sql");

  await mkdir(migrationFolderPath);
  await writeFile(migrationFilePath, "-- Enter your migration here.", "utf-8");

  console.log(chalk.green(`Created migration ${migrationFilePath}.`));
};
