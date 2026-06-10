import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import postgres, { type Sql } from "postgres";
import { assertEnv, env } from "@/lib/env";
import type {
  AppDatabase,
  HistoryEntry,
  LibraryEntry,
  SessionRecord,
  StoredHistoryEntry,
  StoredLibraryEntry,
  StreamMappingRecord,
  UserRecord,
} from "@/types/account";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "app-db.json");

// Watch history is bounded to the most recent N entries per user, enforced on
// every write so a single row can never grow without limit.
const HISTORY_LIMIT = 120;

export class UniqueConstraintError extends Error {
  field: "email" | "username";

  constructor(field: "email" | "username") {
    super(
      field === "email"
        ? "An account with that email already exists."
        : "That username is already taken.",
    );
    this.name = "UniqueConstraintError";
    this.field = field;
  }
}

export type Store = {
  getUserById(id: string): Promise<UserRecord | null>;
  getUserByEmail(email: string): Promise<UserRecord | null>;
  getUserByUsername(username: string): Promise<UserRecord | null>;
  insertUser(user: UserRecord): Promise<void>;
  updateUser(user: UserRecord): Promise<void>;
  deleteUser(id: string): Promise<void>;
  isUsernameTaken(username: string, excludeUserId?: string): Promise<boolean>;

  getSession(id: string): Promise<SessionRecord | null>;
  insertSession(
    session: SessionRecord,
    options?: { replaceForUserAgent?: boolean },
  ): Promise<void>;
  deleteSession(id: string): Promise<void>;
  touchSession(id: string, lastSeenAt: string): Promise<void>;

  getStreamMapping(
    anilistId: number,
    providerId: string,
  ): Promise<StreamMappingRecord | null>;
  upsertStreamMapping(record: StreamMappingRecord): Promise<void>;
  deleteStreamMapping(anilistId: number, providerId: string): Promise<void>;

  /* Library entries — one row per (user, anime), read/written in isolation so
   * a tracking change never touches the user record or other entries. */
  listLibraryEntries(userId: string): Promise<LibraryEntry[]>;
  getLibraryEntry(
    userId: string,
    animeId: number,
  ): Promise<LibraryEntry | null>;
  saveLibraryEntry(userId: string, entry: LibraryEntry): Promise<void>;
  saveLibraryEntries(userId: string, entries: LibraryEntry[]): Promise<void>;
  removeLibraryEntry(
    userId: string,
    animeId: number,
  ): Promise<LibraryEntry | null>;

  /* Watch history — one row per (user, anime, episode), capped per user. */
  listHistoryEntries(userId: string): Promise<HistoryEntry[]>;
  getHistoryEntry(
    userId: string,
    animeId: number,
    episode: number,
  ): Promise<HistoryEntry | null>;
  saveHistoryEntry(userId: string, entry: HistoryEntry): Promise<void>;
  replaceHistoryEntries(userId: string, entries: HistoryEntry[]): Promise<void>;
  removeHistoryEntry(
    userId: string,
    entryId: string,
  ): Promise<HistoryEntry | null>;
  clearHistoryEntries(userId: string): Promise<void>;

  /**
   * Removes guest accounts (and their sessions) that have been inactive
   * since the cutoff. Returns the number of users removed.
   */
  cleanupGuests(cutoffIso: string): Promise<number>;
};

/* ------------------------------------------------------------------ */
/* Postgres implementation: one row per entity, no whole-DB rewrites. */
/* ------------------------------------------------------------------ */

let sqlClient: Sql | null = null;
let schemaReady: Promise<void> | null = null;

function getSqlClient(): Sql | null {
  if (!env.databaseUrl) {
    return null;
  }

  if (!sqlClient) {
    sqlClient = postgres(env.databaseUrl, {
      // A single connection serializes every query app-wide: a background
      // AniList sync would block a user's "mark watched". The Neon pooler
      // (PgBouncer) fronts this, so a small client pool is safe and lets
      // concurrent requests run in parallel instead of queueing.
      max: 10,
      idle_timeout: 30,
      connect_timeout: 10,
      // Required for the Neon pooler (transaction-mode PgBouncer can't reuse
      // server-side prepared statements across pooled connections).
      prepare: false,
    });
  }

  return sqlClient;
}

async function migrateLegacyBlob(sql: Sql) {
  const legacyTable = await sql<{ exists: boolean }[]>`
    select exists (
      select from information_schema.tables where table_name = 'app_state'
    ) as exists
  `;

  if (!legacyTable[0]?.exists) {
    return;
  }

  const rows = await sql<{ payload: unknown }[]>`
    select payload from app_state where id = 'default' limit 1
  `;
  const payload = rows[0]?.payload as Partial<AppDatabase> | undefined;

  if (payload) {
    const users = Array.isArray(payload.users) ? payload.users : [];
    const sessions = Array.isArray(payload.sessions) ? payload.sessions : [];
    const mappings = Array.isArray(payload.streamMappings)
      ? payload.streamMappings
      : [];

    for (const user of users) {
      await sql`
        insert into users (id, email, username, is_guest, payload, created_at)
        values (
          ${user.id},
          ${user.email},
          ${user.username},
          ${Boolean(user.isGuest)},
          ${sql.json(user as never)},
          ${user.joinedAt || new Date().toISOString()}
        )
        on conflict (id) do nothing
      `;
    }

    for (const session of sessions) {
      await sql`
        insert into sessions (id, user_id, user_agent, payload, created_at, last_seen_at)
        values (
          ${session.id},
          ${session.userId},
          ${session.userAgent || ""},
          ${sql.json(session as never)},
          ${session.createdAt || new Date().toISOString()},
          ${session.lastSeenAt || new Date().toISOString()}
        )
        on conflict (id) do nothing
      `;
    }

    for (const mapping of mappings) {
      await sql`
        insert into stream_mappings (anilist_id, provider_id, payload, verified_at)
        values (
          ${mapping.anilistId},
          ${mapping.providerId},
          ${sql.json(mapping as never)},
          ${mapping.verifiedAt || new Date().toISOString()}
        )
        on conflict (anilist_id, provider_id) do nothing
      `;
    }

    // Mark migrated so this only runs once; the legacy row is kept renamed
    // as a backup rather than deleted.
    await sql`
      update app_state set id = 'migrated-to-tables' where id = 'default'
    `;
    console.log(
      `Migrated legacy app_state blob: ${users.length} users, ${sessions.length} sessions, ${mappings.length} stream mappings.`,
    );
  }
}

/**
 * One-time migration off the inline blob model: any user whose payload still
 * embeds libraryEntries/historyEntries has them moved into the dedicated tables
 * and stripped from the payload. Idempotent — once stripped, the guard query
 * matches nothing, so this is a no-op on every subsequent boot.
 */
async function migrateEmbeddedEntries(sql: Sql) {
  const rows = await sql<{ id: string; payload: unknown }[]>`
    select id, payload from users
    where jsonb_exists(payload, 'libraryEntries')
       or jsonb_exists(payload, 'historyEntries')
    limit 1000
  `;

  for (const row of rows) {
    const payload = row.payload as {
      libraryEntries?: LibraryEntry[];
      historyEntries?: HistoryEntry[];
    };
    const library = Array.isArray(payload.libraryEntries)
      ? payload.libraryEntries
      : [];
    const history = Array.isArray(payload.historyEntries)
      ? payload.historyEntries
      : [];

    for (const entry of library) {
      await sql`
        insert into library_entries (user_id, anime_id, payload, updated_at)
        values (
          ${row.id},
          ${entry.animeId},
          ${sql.json(entry as never)},
          ${entry.updatedAt || new Date().toISOString()}
        )
        on conflict (user_id, anime_id) do nothing
      `;
    }

    for (const entry of history) {
      await sql`
        insert into history_entries (user_id, anime_id, episode, payload, watched_at)
        values (
          ${row.id},
          ${entry.animeId},
          ${entry.episode},
          ${sql.json(entry as never)},
          ${entry.watchedAt || new Date().toISOString()}
        )
        on conflict (user_id, anime_id, episode) do nothing
      `;
    }

    await sql`
      update users
      set payload = payload - 'libraryEntries' - 'historyEntries'
      where id = ${row.id}
    `;
  }

  if (rows.length > 0) {
    console.log(`Migrated embedded library/history for ${rows.length} user(s).`);
  }
}

async function ensureSchema(sql: Sql): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      assertEnv();

      await sql`
        create table if not exists users (
          id text primary key,
          email text unique,
          username text unique,
          is_guest boolean not null default false,
          payload jsonb not null,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        )
      `;
      await sql`
        create table if not exists sessions (
          id text primary key,
          user_id text not null references users(id) on delete cascade,
          user_agent text not null default '',
          payload jsonb not null,
          created_at timestamptz not null default now(),
          last_seen_at timestamptz not null default now()
        )
      `;
      await sql`
        create index if not exists sessions_user_idx on sessions(user_id)
      `;
      await sql`
        create table if not exists stream_mappings (
          anilist_id integer not null,
          provider_id text not null,
          payload jsonb not null,
          verified_at timestamptz not null default now(),
          primary key (anilist_id, provider_id)
        )
      `;
      await sql`
        create table if not exists library_entries (
          user_id text not null references users(id) on delete cascade,
          anime_id integer not null,
          payload jsonb not null,
          updated_at timestamptz not null default now(),
          primary key (user_id, anime_id)
        )
      `;
      await sql`
        create index if not exists library_entries_user_idx
          on library_entries(user_id, updated_at desc)
      `;
      await sql`
        create table if not exists history_entries (
          user_id text not null references users(id) on delete cascade,
          anime_id integer not null,
          episode integer not null,
          payload jsonb not null,
          watched_at timestamptz not null default now(),
          primary key (user_id, anime_id, episode)
        )
      `;
      await sql`
        create index if not exists history_entries_user_idx
          on history_entries(user_id, watched_at desc)
      `;

      await migrateLegacyBlob(sql);
      await migrateEmbeddedEntries(sql);
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }

  return schemaReady;
}

function isUniqueViolation(error: unknown): error is { constraint_name?: string } {
  return Boolean(
    error &&
      typeof error === "object" &&
      (error as { code?: string }).code === "23505",
  );
}

function throwFriendlyUniqueError(error: unknown): never {
  if (isUniqueViolation(error)) {
    const constraint =
      (error as { constraint_name?: string }).constraint_name || "";
    throw new UniqueConstraintError(
      constraint.includes("email") ? "email" : "username",
    );
  }

  throw error;
}

function userFromRow(row: { payload: unknown } | undefined): UserRecord | null {
  return row ? (row.payload as UserRecord) : null;
}

function createPostgresStore(sql: Sql): Store {
  return {
    async getUserById(id) {
      await ensureSchema(sql);
      const rows = await sql<{ payload: unknown }[]>`
        select payload from users where id = ${id} limit 1
      `;
      return userFromRow(rows[0]);
    },

    async getUserByEmail(email) {
      await ensureSchema(sql);
      const rows = await sql<{ payload: unknown }[]>`
        select payload from users where email = ${email} limit 1
      `;
      return userFromRow(rows[0]);
    },

    async getUserByUsername(username) {
      await ensureSchema(sql);
      const rows = await sql<{ payload: unknown }[]>`
        select payload from users where username = ${username} limit 1
      `;
      return userFromRow(rows[0]);
    },

    async insertUser(user) {
      await ensureSchema(sql);
      try {
        await sql`
          insert into users (id, email, username, is_guest, payload, created_at)
          values (
            ${user.id},
            ${user.email},
            ${user.username},
            ${Boolean(user.isGuest)},
            ${sql.json(user as never)},
            ${user.joinedAt || new Date().toISOString()}
          )
        `;
      } catch (error) {
        throwFriendlyUniqueError(error);
      }
    },

    async updateUser(user) {
      await ensureSchema(sql);
      try {
        await sql`
          update users set
            email = ${user.email},
            username = ${user.username},
            is_guest = ${Boolean(user.isGuest)},
            payload = ${sql.json(user as never)},
            updated_at = now()
          where id = ${user.id}
        `;
      } catch (error) {
        throwFriendlyUniqueError(error);
      }
    },

    async deleteUser(id) {
      await ensureSchema(sql);
      await sql`delete from sessions where user_id = ${id}`;
      await sql`delete from users where id = ${id}`;
    },

    async isUsernameTaken(username, excludeUserId) {
      await ensureSchema(sql);
      const rows = await sql<{ id: string }[]>`
        select id from users
        where username = ${username} and id <> ${excludeUserId || ""}
        limit 1
      `;
      return rows.length > 0;
    },

    async getSession(id) {
      await ensureSchema(sql);
      const rows = await sql<{ payload: unknown }[]>`
        select payload from sessions where id = ${id} limit 1
      `;
      return rows[0] ? (rows[0].payload as SessionRecord) : null;
    },

    async insertSession(session, options) {
      await ensureSchema(sql);
      if (options?.replaceForUserAgent) {
        await sql`
          delete from sessions
          where user_id = ${session.userId} and user_agent = ${session.userAgent}
        `;
      }
      await sql`
        insert into sessions (id, user_id, user_agent, payload, created_at, last_seen_at)
        values (
          ${session.id},
          ${session.userId},
          ${session.userAgent},
          ${sql.json(session as never)},
          ${session.createdAt},
          ${session.lastSeenAt}
        )
      `;
    },

    async deleteSession(id) {
      await ensureSchema(sql);
      await sql`delete from sessions where id = ${id}`;
    },

    async touchSession(id, lastSeenAt) {
      await ensureSchema(sql);
      await sql`
        update sessions set
          last_seen_at = ${lastSeenAt},
          payload = payload || ${sql.json({ lastSeenAt })}
        where id = ${id}
      `;
    },

    async getStreamMapping(anilistId, providerId) {
      await ensureSchema(sql);
      const rows = await sql<{ payload: unknown }[]>`
        select payload from stream_mappings
        where anilist_id = ${anilistId} and provider_id = ${providerId}
        limit 1
      `;
      return rows[0] ? (rows[0].payload as StreamMappingRecord) : null;
    },

    async upsertStreamMapping(record) {
      await ensureSchema(sql);
      await sql`
        insert into stream_mappings (anilist_id, provider_id, payload, verified_at)
        values (
          ${record.anilistId},
          ${record.providerId},
          ${sql.json(record as never)},
          ${record.verifiedAt}
        )
        on conflict (anilist_id, provider_id) do update set
          payload = excluded.payload,
          verified_at = excluded.verified_at
      `;
    },

    async deleteStreamMapping(anilistId, providerId) {
      await ensureSchema(sql);
      await sql`
        delete from stream_mappings
        where anilist_id = ${anilistId} and provider_id = ${providerId}
      `;
    },

    async listLibraryEntries(userId) {
      await ensureSchema(sql);
      const rows = await sql<{ payload: unknown }[]>`
        select payload from library_entries
        where user_id = ${userId}
        order by updated_at desc
      `;
      return rows.map((row) => row.payload as LibraryEntry);
    },

    async getLibraryEntry(userId, animeId) {
      await ensureSchema(sql);
      const rows = await sql<{ payload: unknown }[]>`
        select payload from library_entries
        where user_id = ${userId} and anime_id = ${animeId}
        limit 1
      `;
      return rows[0] ? (rows[0].payload as LibraryEntry) : null;
    },

    async saveLibraryEntry(userId, entry) {
      await ensureSchema(sql);
      await sql`
        insert into library_entries (user_id, anime_id, payload, updated_at)
        values (
          ${userId},
          ${entry.animeId},
          ${sql.json(entry as never)},
          ${entry.updatedAt || new Date().toISOString()}
        )
        on conflict (user_id, anime_id) do update set
          payload = excluded.payload,
          updated_at = excluded.updated_at
      `;
    },

    async saveLibraryEntries(userId, entries) {
      if (entries.length === 0) {
        return;
      }
      await ensureSchema(sql);
      await sql.begin(async (tx) => {
        for (const entry of entries) {
          await tx`
            insert into library_entries (user_id, anime_id, payload, updated_at)
            values (
              ${userId},
              ${entry.animeId},
              ${sql.json(entry as never)},
              ${entry.updatedAt || new Date().toISOString()}
            )
            on conflict (user_id, anime_id) do update set
              payload = excluded.payload,
              updated_at = excluded.updated_at
          `;
        }
      });
    },

    async removeLibraryEntry(userId, animeId) {
      await ensureSchema(sql);
      const rows = await sql<{ payload: unknown }[]>`
        delete from library_entries
        where user_id = ${userId} and anime_id = ${animeId}
        returning payload
      `;
      return rows[0] ? (rows[0].payload as LibraryEntry) : null;
    },

    async listHistoryEntries(userId) {
      await ensureSchema(sql);
      const rows = await sql<{ payload: unknown }[]>`
        select payload from history_entries
        where user_id = ${userId}
        order by watched_at desc
        limit ${HISTORY_LIMIT}
      `;
      return rows.map((row) => row.payload as HistoryEntry);
    },

    async getHistoryEntry(userId, animeId, episode) {
      await ensureSchema(sql);
      const rows = await sql<{ payload: unknown }[]>`
        select payload from history_entries
        where user_id = ${userId}
          and anime_id = ${animeId}
          and episode = ${episode}
        limit 1
      `;
      return rows[0] ? (rows[0].payload as HistoryEntry) : null;
    },

    async replaceHistoryEntries(userId, entries) {
      await ensureSchema(sql);
      await sql.begin(async (tx) => {
        await tx`delete from history_entries where user_id = ${userId}`;
        for (const entry of entries.slice(0, HISTORY_LIMIT)) {
          await tx`
            insert into history_entries (user_id, anime_id, episode, payload, watched_at)
            values (
              ${userId},
              ${entry.animeId},
              ${entry.episode},
              ${sql.json(entry as never)},
              ${entry.watchedAt || new Date().toISOString()}
            )
            on conflict (user_id, anime_id, episode) do update set
              payload = excluded.payload,
              watched_at = excluded.watched_at
          `;
        }
      });
    },

    async saveHistoryEntry(userId, entry) {
      await ensureSchema(sql);
      await sql`
        insert into history_entries (user_id, anime_id, episode, payload, watched_at)
        values (
          ${userId},
          ${entry.animeId},
          ${entry.episode},
          ${sql.json(entry as never)},
          ${entry.watchedAt || new Date().toISOString()}
        )
        on conflict (user_id, anime_id, episode) do update set
          payload = excluded.payload,
          watched_at = excluded.watched_at
      `;
      // Keep only the most recent HISTORY_LIMIT entries for this user.
      await sql`
        delete from history_entries
        where user_id = ${userId}
          and (anime_id, episode) not in (
            select anime_id, episode from history_entries
            where user_id = ${userId}
            order by watched_at desc
            limit ${HISTORY_LIMIT}
          )
      `;
    },

    async removeHistoryEntry(userId, entryId) {
      await ensureSchema(sql);
      const rows = await sql<{ payload: unknown }[]>`
        delete from history_entries
        where user_id = ${userId} and payload->>'id' = ${entryId}
        returning payload
      `;
      return rows[0] ? (rows[0].payload as HistoryEntry) : null;
    },

    async clearHistoryEntries(userId) {
      await ensureSchema(sql);
      await sql`delete from history_entries where user_id = ${userId}`;
    },

    async cleanupGuests(cutoffIso) {
      await ensureSchema(sql);
      const removed = await sql<{ id: string }[]>`
        delete from users
        where is_guest
          and created_at < ${cutoffIso}
          and not exists (
            select 1 from sessions
            where sessions.user_id = users.id
              and sessions.last_seen_at >= ${cutoffIso}
          )
        returning id
      `;
      return removed.length;
    },
  };
}

/* ------------------------------------------------------- */
/* JSON file implementation: development fallback only.     */
/* ------------------------------------------------------- */

let writeQueue = Promise.resolve();

function createEmptyDb(): AppDatabase {
  return {
    users: [],
    sessions: [],
    streamMappings: [],
    libraryEntries: [],
    historyEntries: [],
  };
}

/** Drops the owner tag so a stored row reads back as its public shape. */
function stripOwner<T extends { userId: string }>(row: T): Omit<T, "userId"> {
  const copy = { ...row } as Partial<T>;
  delete copy.userId;
  return copy as Omit<T, "userId">;
}

function normalizeDb(value: unknown): AppDatabase {
  if (!value || typeof value !== "object") {
    return createEmptyDb();
  }

  const candidate = value as Partial<AppDatabase>;
  const users = Array.isArray(candidate.users) ? candidate.users : [];
  const libraryEntries: StoredLibraryEntry[] = Array.isArray(
    candidate.libraryEntries,
  )
    ? candidate.libraryEntries
    : [];
  const historyEntries: StoredHistoryEntry[] = Array.isArray(
    candidate.historyEntries,
  )
    ? candidate.historyEntries
    : [];

  // Hoist any library/history still embedded on a user (legacy blob model)
  // into the top-level collections, then drop them from the user object so the
  // file store converges on the normalized shape after the first write. Set-keyed
  // dedup keeps this O(n) even for a large legacy file.
  const libKeys = new Set(
    libraryEntries.map((row) => `${row.userId}:${row.animeId}`),
  );
  const historyKeys = new Set(
    historyEntries.map(
      (row) => `${row.userId}:${row.animeId}:${row.episode}`,
    ),
  );
  for (const user of users) {
    const legacy = user as UserRecord & {
      libraryEntries?: LibraryEntry[];
      historyEntries?: HistoryEntry[];
    };
    if (Array.isArray(legacy.libraryEntries)) {
      for (const entry of legacy.libraryEntries) {
        const key = `${user.id}:${entry.animeId}`;
        if (!libKeys.has(key)) {
          libKeys.add(key);
          libraryEntries.push({ ...entry, userId: user.id });
        }
      }
      delete legacy.libraryEntries;
    }
    if (Array.isArray(legacy.historyEntries)) {
      for (const entry of legacy.historyEntries) {
        const key = `${user.id}:${entry.animeId}:${entry.episode}`;
        if (!historyKeys.has(key)) {
          historyKeys.add(key);
          historyEntries.push({ ...entry, userId: user.id });
        }
      }
      delete legacy.historyEntries;
    }
  }

  return {
    users,
    sessions: Array.isArray(candidate.sessions) ? candidate.sessions : [],
    streamMappings: Array.isArray(candidate.streamMappings)
      ? candidate.streamMappings
      : [],
    libraryEntries,
    historyEntries,
  };
}

async function readFileDb(): Promise<AppDatabase> {
  try {
    return normalizeDb(JSON.parse(await readFile(DB_PATH, "utf8")));
  } catch {
    return createEmptyDb();
  }
}

async function mutateFileDb<T>(
  mutate: (db: AppDatabase) => T | Promise<T>,
): Promise<T> {
  let result: T;

  const next = writeQueue.then(async () => {
    const db = await readFileDb();
    result = await mutate(db);
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf8");
  });

  writeQueue = next.catch(() => undefined);
  await next;

  return result!;
}

function createFileStore(): Store {
  assertEnv();

  return {
    async getUserById(id) {
      const db = await readFileDb();
      return db.users.find((user) => user.id === id) || null;
    },

    async getUserByEmail(email) {
      const db = await readFileDb();
      return db.users.find((user) => user.email === email) || null;
    },

    async getUserByUsername(username) {
      const db = await readFileDb();
      return db.users.find((user) => user.username === username) || null;
    },

    async insertUser(user) {
      await mutateFileDb((db) => {
        if (user.email && db.users.some((entry) => entry.email === user.email)) {
          throw new UniqueConstraintError("email");
        }
        if (db.users.some((entry) => entry.username === user.username)) {
          throw new UniqueConstraintError("username");
        }
        db.users.push(user);
      });
    },

    async updateUser(user) {
      await mutateFileDb((db) => {
        if (
          db.users.some(
            (entry) => entry.id !== user.id && entry.username === user.username,
          )
        ) {
          throw new UniqueConstraintError("username");
        }
        const index = db.users.findIndex((entry) => entry.id === user.id);
        if (index !== -1) {
          db.users[index] = user;
        }
      });
    },

    async deleteUser(id) {
      await mutateFileDb((db) => {
        db.users = db.users.filter((user) => user.id !== id);
        db.sessions = db.sessions.filter((session) => session.userId !== id);
      });
    },

    async isUsernameTaken(username, excludeUserId) {
      const db = await readFileDb();
      return db.users.some(
        (user) => user.username === username && user.id !== excludeUserId,
      );
    },

    async getSession(id) {
      const db = await readFileDb();
      return db.sessions.find((session) => session.id === id) || null;
    },

    async insertSession(session, options) {
      await mutateFileDb((db) => {
        if (options?.replaceForUserAgent) {
          db.sessions = db.sessions.filter(
            (entry) =>
              entry.userId !== session.userId ||
              entry.userAgent !== session.userAgent,
          );
        }
        db.sessions.push(session);
      });
    },

    async deleteSession(id) {
      await mutateFileDb((db) => {
        db.sessions = db.sessions.filter((session) => session.id !== id);
      });
    },

    async touchSession(id, lastSeenAt) {
      await mutateFileDb((db) => {
        const session = db.sessions.find((entry) => entry.id === id);
        if (session) {
          session.lastSeenAt = lastSeenAt;
        }
      });
    },

    async getStreamMapping(anilistId, providerId) {
      const db = await readFileDb();
      return (
        (db.streamMappings || []).find(
          (mapping) =>
            mapping.anilistId === anilistId &&
            mapping.providerId === providerId,
        ) || null
      );
    },

    async upsertStreamMapping(record) {
      await mutateFileDb((db) => {
        db.streamMappings = [
          ...(db.streamMappings || []).filter(
            (mapping) =>
              mapping.anilistId !== record.anilistId ||
              mapping.providerId !== record.providerId,
          ),
          record,
        ];
      });
    },

    async deleteStreamMapping(anilistId, providerId) {
      await mutateFileDb((db) => {
        db.streamMappings = (db.streamMappings || []).filter(
          (mapping) =>
            mapping.anilistId !== anilistId ||
            mapping.providerId !== providerId,
        );
      });
    },

    async listLibraryEntries(userId) {
      const db = await readFileDb();
      return (db.libraryEntries || [])
        .filter((row) => row.userId === userId)
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        )
        .map(stripOwner);
    },

    async getLibraryEntry(userId, animeId) {
      const db = await readFileDb();
      const existing = (db.libraryEntries || []).find(
        (row) => row.userId === userId && row.animeId === animeId,
      );
      return existing ? stripOwner(existing) : null;
    },

    async saveLibraryEntry(userId, entry) {
      await mutateFileDb((db) => {
        db.libraryEntries = [
          ...(db.libraryEntries || []).filter(
            (row) => !(row.userId === userId && row.animeId === entry.animeId),
          ),
          { ...entry, userId },
        ];
      });
    },

    async saveLibraryEntries(userId, entries) {
      if (entries.length === 0) {
        return;
      }
      await mutateFileDb((db) => {
        const incoming = new Set(entries.map((entry) => entry.animeId));
        const others = (db.libraryEntries || []).filter(
          (row) => !(row.userId === userId && incoming.has(row.animeId)),
        );
        db.libraryEntries = [
          ...others,
          ...entries.map((entry) => ({ ...entry, userId })),
        ];
      });
    },

    async removeLibraryEntry(userId, animeId) {
      return mutateFileDb((db) => {
        const existing = (db.libraryEntries || []).find(
          (row) => row.userId === userId && row.animeId === animeId,
        );
        db.libraryEntries = (db.libraryEntries || []).filter(
          (row) => !(row.userId === userId && row.animeId === animeId),
        );
        return existing ? stripOwner(existing) : null;
      });
    },

    async listHistoryEntries(userId) {
      const db = await readFileDb();
      return (db.historyEntries || [])
        .filter((row) => row.userId === userId)
        .sort(
          (a, b) =>
            new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime(),
        )
        .slice(0, HISTORY_LIMIT)
        .map(stripOwner);
    },

    async getHistoryEntry(userId, animeId, episode) {
      const db = await readFileDb();
      const existing = (db.historyEntries || []).find(
        (row) =>
          row.userId === userId &&
          row.animeId === animeId &&
          row.episode === episode,
      );
      return existing ? stripOwner(existing) : null;
    },

    async replaceHistoryEntries(userId, entries) {
      await mutateFileDb((db) => {
        const notMine = (db.historyEntries || []).filter(
          (row) => row.userId !== userId,
        );
        const mine = entries
          .slice(0, HISTORY_LIMIT)
          .map((entry) => ({ ...entry, userId }));
        db.historyEntries = [...notMine, ...mine];
      });
    },

    async saveHistoryEntry(userId, entry) {
      await mutateFileDb((db) => {
        const all = db.historyEntries || [];
        const notMine = all.filter((row) => row.userId !== userId);
        const mine = [
          { ...entry, userId },
          ...all.filter(
            (row) =>
              row.userId === userId &&
              !(row.animeId === entry.animeId && row.episode === entry.episode),
          ),
        ]
          .sort(
            (a, b) =>
              new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime(),
          )
          .slice(0, HISTORY_LIMIT);
        db.historyEntries = [...notMine, ...mine];
      });
    },

    async removeHistoryEntry(userId, entryId) {
      return mutateFileDb((db) => {
        const existing = (db.historyEntries || []).find(
          (row) => row.userId === userId && row.id === entryId,
        );
        db.historyEntries = (db.historyEntries || []).filter(
          (row) => !(row.userId === userId && row.id === entryId),
        );
        return existing ? stripOwner(existing) : null;
      });
    },

    async clearHistoryEntries(userId) {
      await mutateFileDb((db) => {
        db.historyEntries = (db.historyEntries || []).filter(
          (row) => row.userId !== userId,
        );
      });
    },

    async cleanupGuests(cutoffIso) {
      return mutateFileDb((db) => {
        const cutoff = Date.parse(cutoffIso);
        const activeUserIds = new Set(
          db.sessions
            .filter((session) => Date.parse(session.lastSeenAt) >= cutoff)
            .map((session) => session.userId),
        );
        const expired = new Set(
          db.users
            .filter(
              (user) =>
                user.isGuest &&
                Date.parse(user.joinedAt) < cutoff &&
                !activeUserIds.has(user.id),
            )
            .map((user) => user.id),
        );

        db.users = db.users.filter((user) => !expired.has(user.id));
        db.sessions = db.sessions.filter(
          (session) => !expired.has(session.userId),
        );

        return expired.size;
      });
    },
  };
}

/* ------------------ */
/* Store entry point. */
/* ------------------ */

let fileStore: Store | null = null;
let postgresStore: Store | null = null;

export function getStore(): Store {
  const sql = getSqlClient();

  if (sql) {
    if (!postgresStore) {
      postgresStore = createPostgresStore(sql);
    }
    return postgresStore;
  }

  if (!fileStore) {
    fileStore = createFileStore();
  }
  return fileStore;
}
