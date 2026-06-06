import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import postgres, { type Sql } from "postgres";
import { assertEnv, env } from "@/lib/env";
import type {
  AppDatabase,
  SessionRecord,
  StreamMappingRecord,
  UserRecord,
} from "@/types/account";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "app-db.json");

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
      max: 1,
      idle_timeout: 30,
      connect_timeout: 10,
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

      await migrateLegacyBlob(sql);
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
  return { users: [], sessions: [], streamMappings: [] };
}

function normalizeDb(value: unknown): AppDatabase {
  if (!value || typeof value !== "object") {
    return createEmptyDb();
  }

  const candidate = value as Partial<AppDatabase>;

  return {
    users: Array.isArray(candidate.users) ? candidate.users : [],
    sessions: Array.isArray(candidate.sessions) ? candidate.sessions : [],
    streamMappings: Array.isArray(candidate.streamMappings)
      ? candidate.streamMappings
      : [],
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
