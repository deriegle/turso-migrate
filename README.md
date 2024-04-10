# `@deriegle/turso-migrate`

This is a CLI tool to easy and quickly run SQL migrations against Turso in a predictable way.

**This tool is still currently a work in progress and is not advised to be used against a production database.**

## Commands

### Create

This command will create a new migration file in schema folder you specify. You can provide an optional name if you'd like to name the migration file. It will be prefixed with the current unix timestamp. If no name is provided, a random name will be generated.

```bin
Usage: @deriegle/turso-migrate create [options] [name]

Create a new migration file

Arguments:
  name                         Name of the migration file

Options:
  -s, --schemaFolder <schema>  Path to schema folder
  -h, --help                   display help for command
```

### Migrate Command

This command will create a new migration file in schema folder you specify. You can provide an optional name if you'd like to name the migration file. It will be prefixed with the current unix timestamp. If no name is provided, a random name will be generated.

```bin
Usage: @deriegle/turso-migrate migrate [options]

Migrates the database

Options:
  -d, --databaseUrl <databaseUrl>      Turso Database URL
  -a, --databaseAuthToken <authToken>  Turso Database Auth Token
  -s, --schemaFolder <schema>          Path to schema to migrate
  -h, --help                           display help for command
```

### Resolve Command

This command can be used to resolve issues with migrations.

```bin
Usage: @deriegle/turso-migrate resolve [options]

Updates a migration file status. This can be useful to mark a migration as complete manually or pending if you want to run it again.

Options:
  -d, --databaseUrl <databaseUrl>      Turso Database URL
  -a, --databaseAuthToken <authToken>  Turso Database Auth Token
  -s, --schemaFolder <schema>          Path to schema folder
  --completed <migrationName>          Migration to mark as completed
  --pending <migrationName>            Migration to mark as pending
  -h, --help                           display help for command
```

### Status Command

This command will print a table of the status of your current migrations.

```bin
Usage: @deriegle/turso-migrate status [options]

Shows the status of migrations

Options:
  -d, --databaseUrl <databaseUrl>      Turso Database URL
  -a, --databaseAuthToken <authToken>  Turso Database Auth Token
  -s, --schemaFolder <schema>          Path to schema to migrate
  -h, --help                           display help for command
```

### Help Command

Command to print our help for available commands.

```bin
Usage: @deriegle/turso-migrate [options] [command]

CLI tool to make migrations in Turso easier.

Options:
  -V, --version            output the version number
  -h, --help               display help for command

Commands:
  create [options] [name]  Create a new migration file
  migrate [options]        Migrates the database
  resolve [options]        Updates a migration file status. This can be useful to mark a migration as complete manually or pending if you want to
                           run it again.
  status [options]         Shows the status of migrations
  help [command]           display help for command
```
