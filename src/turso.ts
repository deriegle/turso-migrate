import { Client as LibSQLClient, createClient } from "@libsql/client";
import { Result } from "./result";

export async function getClient({
  databaseAuthToken,
  databaseUrl,
}: {
  databaseAuthToken: string;
  databaseUrl: string;
}): Promise<Result<LibSQLClient>> {
  if (!databaseUrl.startsWith("libsql://")) {
    return Result.failure("Invalid database URL. Must start with libsql://");
  }

  const client = createClient({
    authToken: databaseAuthToken,
    url: databaseUrl,
  });

  return client
    .execute("SELECT 1")
    .then(() => Result.ok(client))
    .catch((err) =>
      Result.failure(
        `${err} Could not connect to the database. Please check your credentials.`
      )
    );
}
