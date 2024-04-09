export const migrationStatuses = ["pending", "errored", "completed"] as const;

export type MigrationStatus = (typeof migrationStatuses)[number];

export type Migration = {
  name: string;
  status: MigrationStatus;
  fileContents: string;
  path: string;
  sha: string;
  error?: string;
};
