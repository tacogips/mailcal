import type { SqlDatabase } from "@yabumi/application/ports/sql-database";
import { describe, expect, test } from "vitest";
import { createInMemoryDatabase } from "../sql/libsql";
import { loadMigrationFiles } from "../repositories/test-support";
import { createMigrationRunner, type MigrationFile } from "./runner";

const simple: readonly MigrationFile[] = [
  { name: "0001_a.sql", sql: "CREATE TABLE a (id TEXT PRIMARY KEY);" },
  { name: "0002_b.sql", sql: "CREATE TABLE b (id TEXT PRIMARY KEY);" },
];

async function tableNames(db: SqlDatabase): Promise<readonly string[]> {
  const rows = await db.query<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
  );
  return rows.map((row) => row.name);
}

describe("createMigrationRunner", () => {
  test("applies pending migrations and records them", async () => {
    const db = createInMemoryDatabase();
    const runner = createMigrationRunner(db);
    const { applied } = await runner.apply(simple);
    expect(applied).toEqual(["0001_a.sql", "0002_b.sql"]);
    expect(await tableNames(db)).toContain("a");
    expect(await tableNames(db)).toContain("b");
  });

  test("re-applying is a no-op", async () => {
    const db = createInMemoryDatabase();
    const runner = createMigrationRunner(db);
    await runner.apply(simple);
    expect((await runner.apply(simple)).applied).toEqual([]);
  });

  test("applies only the newly added migration", async () => {
    const db = createInMemoryDatabase();
    const runner = createMigrationRunner(db);
    await runner.apply([simple[0] as MigrationFile]);
    expect((await runner.apply(simple)).applied).toEqual(["0002_b.sql"]);
  });

  test("applies in name order regardless of input order", async () => {
    const db = createInMemoryDatabase();
    const runner = createMigrationRunner(db);
    const { applied } = await runner.apply([
      simple[1] as MigrationFile,
      simple[0] as MigrationFile,
    ]);
    expect(applied).toEqual(["0001_a.sql", "0002_b.sql"]);
  });

  test("a failing migration is rolled back and rethrown", async () => {
    const db = createInMemoryDatabase();
    const runner = createMigrationRunner(db);
    await expect(
      runner.apply([
        {
          name: "0001_bad.sql",
          sql: "CREATE TABLE ok (id TEXT); THIS IS NOT SQL;",
        },
      ]),
    ).rejects.toThrow();
    expect(await tableNames(db)).not.toContain("ok");
  });

  test("concurrent runners converge without error", async () => {
    const db = createInMemoryDatabase();
    const [first, second] = await Promise.all([
      createMigrationRunner(db).apply(simple),
      createMigrationRunner(db).apply(simple),
    ]);
    // Exactly one runner claims each migration; neither throws.
    const claimed = [...first.applied, ...second.applied].sort();
    expect(new Set(claimed).size).toBe(claimed.length);
    expect(await tableNames(db)).toContain("a");
  });

  test("applies the real production migrations cleanly", async () => {
    const db = createInMemoryDatabase();
    const runner = createMigrationRunner(db);
    const { applied } = await runner.apply(loadMigrationFiles());
    expect(applied).toEqual([
      "0001_init.sql",
      "0002_system_tags.sql",
      "0003_attachment_kind.sql",
      "0004_spam_status_events.sql",
    ]);

    const names = await tableNames(db);
    for (const expected of [
      "users",
      "sessions",
      "email_auth_challenges",
      "domains",
      "messages",
      "message_recipients",
      "attachments",
      "tags",
      "message_tags",
      "api_keys",
      "api_key_scopes",
      "message_fetch_states",
      "file_links",
    ]) {
      expect(names).toContain(expected);
    }

    const systemTags = await db.query<{ system_slug: string }>(
      "SELECT system_slug FROM tags WHERE kind = 'SYSTEM' ORDER BY system_slug",
    );
    // SPAM is deliberately absent: migration 0004 retires the spam tag in
    // favour of the message_spam table.
    expect(systemTags.map((row) => row.system_slug)).toEqual([
      "ARCHIVED",
      "STARRED",
      "TRASH",
    ]);
  });

  test("the real migrations create their indexes", async () => {
    const db = createInMemoryDatabase();
    await createMigrationRunner(db).apply(loadMigrationFiles());
    const rows = await db.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%'",
    );
    const names = rows.map((row) => row.name);
    for (const expected of [
      "idx_messages_listing",
      "idx_recipients_address",
      "idx_fetch_states_key",
      "idx_file_links_token",
      "idx_api_keys_key_hash",
    ]) {
      expect(names).toContain(expected);
    }
  });
});
