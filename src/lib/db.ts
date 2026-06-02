import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AppDatabase } from "@/types/account";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "app-db.json");

let writeQueue = Promise.resolve();

function createEmptyDb(): AppDatabase {
  return {
    users: [],
    sessions: [],
  };
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
  await ensureDbFile();
  const raw = await readFile(DB_PATH, "utf8");

  try {
    return JSON.parse(raw) as AppDatabase;
  } catch {
    return createEmptyDb();
  }
}

export async function writeDb(updater: (db: AppDatabase) => AppDatabase | Promise<AppDatabase>) {
  const nextWrite = writeQueue.catch(() => undefined).then(async () => {
    const current = await readDb();
    const next = await updater(current);
    await writeFile(DB_PATH, JSON.stringify(next, null, 2), "utf8");
  });

  writeQueue = nextWrite.catch(() => undefined);

  return nextWrite;
}
