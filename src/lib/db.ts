import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import postgres, { type Sql } from "postgres";
import type { AppDatabase } from "@/types/account";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "app-db.json");
const DATABASE_URL = process.env.DATABASE_URL || "";
const STATE_ROW_ID = "default";

let writeQueue = Promise.resolve();
let sqlClient: Sql | null = null;
let postgresReady = false;

function createEmptyDb(): AppDatabase {
  return {
    users: [],
    sessions: [],
  };
}

function normalizeDb(value: unknown): AppDatabase {
  if (!value || typeof value !== "object") {
    return createEmptyDb();
  }

  const candidate = value as Partial<AppDatabase>;

  return {
    users: Array.isArray(candidate.users) ? candidate.users : [],
    sessions: Array.isArray(candidate.sessions) ? candidate.sessions : [],
  } as AppDatabase;
}

function getSqlClient(): Sql | null {
  if (!DATABASE_URL) {
    return null;
  }

  if (!sqlClient) {
    sqlClient = postgres(DATABASE_URL, {
      max: 1,
      idle_timeout: 30,
      connect_timeout: 10,
      prepare: false,
    });
  }

  return sqlClient;
}

async function ensurePostgresDb(sql: Sql) {
  if (postgresReady) {
    return;
  }

  await sql`
    create table if not exists app_state (
      id text primary key,
      payload jsonb not null,
      updated_at timestamptz not null default now()
    )
  `;
  await sql`
    insert into app_state (id, payload)
    values (${STATE_ROW_ID}, ${sql.json(createEmptyDb())})
    on conflict (id) do nothing
  `;

  postgresReady = true;
}

async function readPostgresDb(sql: Sql): Promise<AppDatabase> {
  await ensurePostgresDb(sql);

  const rows = await sql<{ payload: unknown }[]>`
    select payload from app_state where id = ${STATE_ROW_ID} limit 1
  `;

  return normalizeDb(rows[0]?.payload);
}

async function writePostgresDb(sql: Sql, db: AppDatabase) {
  await ensurePostgresDb(sql);
  await sql`
    insert into app_state (id, payload, updated_at)
    values (${STATE_ROW_ID}, ${sql.json(db)}, now())
    on conflict (id) do update set
      payload = excluded.payload,
      updated_at = excluded.updated_at
  `;
}

async function ensureDbFile() {
  await mkdir(DATA_DIR, { recursive: true });

  try {
    await readFile(DB_PATH, "utf8");
  } catch {
    await writeFile(DB_PATH, JSON.stringify(createEmptyDb(), null, 2), "utf8");
  }
}

export async function readDb(): Promise<AppDatabase> {
  const sql = getSqlClient();

  if (sql) {
    return readPostgresDb(sql);
  }

  await ensureDbFile();
  const raw = await readFile(DB_PATH, "utf8");

  try {
    return normalizeDb(JSON.parse(raw));
  } catch {
    return createEmptyDb();
  }
}

export async function writeDb(updater: (db: AppDatabase) => AppDatabase | Promise<AppDatabase>) {
  const nextWrite = writeQueue.catch(() => undefined).then(async () => {
    const sql = getSqlClient();
    const current = await readDb();
    const next = await updater(current);

    if (sql) {
      await writePostgresDb(sql, next);
      return;
    }

    await writeFile(DB_PATH, JSON.stringify(next, null, 2), "utf8");
  });

  writeQueue = nextWrite.catch(() => undefined);

  return nextWrite;
}
