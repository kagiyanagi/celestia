import { cookies, headers } from "next/headers";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { writeDb, readDb } from "@/lib/db";
import type {
  DeviceSession,
  PublicUser,
  SessionRecord,
  UserPreferences,
  UserRecord,
} from "@/types/account";

const SESSION_COOKIE = "celestia_session";

function createId(size = 16) {
  return randomBytes(size).toString("hex");
}

function defaultPreferences(): UserPreferences {
  return {
    titleLanguage: "english",
    hideAdultContent: true,
    autoplayTrailers: false,
    videoQuality: "higher_picture_quality",
    autoPlay: false,
    autoNext: false,
    autoSkipIntroOutro: false,
    miniPlayer: false,
  };
}

function hashPassword(password: string) {
  const salt = createId(8);
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string) {
  const [salt, key] = storedHash.split(":");

  if (!salt || !key) {
    return false;
  }

  const hashedBuffer = scryptSync(password, salt, 64);
  const storedBuffer = Buffer.from(key, "hex");

  return (
    hashedBuffer.byteLength === storedBuffer.byteLength &&
    timingSafeEqual(hashedBuffer, storedBuffer)
  );
}

function parseUserAgent(userAgent: string | null): Pick<DeviceSession, "platform" | "browser" | "label"> {
  const source = userAgent || "Unknown device";
  const platform = /android/i.test(source)
    ? "Android"
    : /iphone|ipad|ios/i.test(source)
      ? "iOS"
      : /mac/i.test(source)
        ? "macOS"
        : /windows/i.test(source)
          ? "Windows"
          : /linux/i.test(source)
            ? "Linux"
            : "Unknown";
  const browser = /edg/i.test(source)
    ? "Edge"
    : /chrome/i.test(source)
      ? "Chrome"
      : /safari/i.test(source)
        ? "Safari"
        : /firefox/i.test(source)
          ? "Firefox"
          : "Browser";

  return {
    platform,
    browser,
    label: `${platform} • ${browser}`,
  };
}

function redactUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    username: user.username,
    pronouns: user.pronouns,
    about: user.about,
    avatar: user.avatar,
    banner: user.banner,
    joinedAt: user.joinedAt,
    aniListProfile: user.aniListProfile,
    preferences: user.preferences,
    devices: user.devices,
    libraryEntries: user.libraryEntries,
    historyEntries: user.historyEntries,
  };
}

export function getDefaultProfileAssets() {
  return {
    avatar: null,
    banner: null,
  };
}

export async function createUser(input: {
  email: string;
  password: string;
  displayName: string;
  username: string;
}) {
  const email = input.email.trim().toLowerCase();
  const username = input.username.trim().toLowerCase();
  const displayName = input.displayName.trim();

  if (!displayName) {
    throw new Error("Display name is required.");
  }

  if (!/^[a-z0-9_][a-z0-9_-]{2,29}$/.test(username)) {
    throw new Error(
      "Username must be 3-30 characters and use letters, numbers, underscores, or hyphens.",
    );
  }

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw new Error("Enter a valid email address.");
  }

  if (input.password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  const now = new Date().toISOString();
  const assets = getDefaultProfileAssets();
  const user: UserRecord = {
    id: createId(),
    email,
    passwordHash: hashPassword(input.password),
    displayName,
    username,
    pronouns: "",
    about: "",
    avatar: assets.avatar,
    banner: assets.banner,
    joinedAt: now,
    aniListAccessToken: null,
    aniListProfile: null,
    preferences: defaultPreferences(),
    devices: [],
    libraryEntries: [],
    historyEntries: [],
  };

  await writeDb((current) => {
    if (current.users.some((entry) => entry.email === email)) {
      throw new Error("An account with that email already exists.");
    }

    if (current.users.some((entry) => entry.username === username)) {
      throw new Error("That username is already taken.");
    }

    return {
      ...current,
      users: [...current.users, user],
    };
  });

  return redactUser(user);
}

export async function authenticateUser(email: string, password: string) {
  const db = await readDb();
  const user = db.users.find((entry) => entry.email === email.trim().toLowerCase());

  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new Error("Invalid email or password.");
  }

  return redactUser(user);
}

export async function createSession(userId: string) {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const sessionId = createId();
  const userAgent = headerStore.get("user-agent") || "";
  const now = new Date().toISOString();
  const nextSession: SessionRecord = {
    id: sessionId,
    userId,
    createdAt: now,
    lastSeenAt: now,
    userAgent,
  };
  const ua = parseUserAgent(userAgent);

  await writeDb((db) => ({
    ...db,
    sessions: [...db.sessions.filter((session) => session.userId !== userId || session.userAgent !== userAgent), nextSession],
    users: db.users.map((user) =>
      user.id === userId
        ? {
            ...user,
            devices: [
              {
                id: sessionId,
                platform: ua.platform,
                browser: ua.browser,
                label: ua.label,
                locationLabel: "IN",
                lastActiveAt: now,
                current: true,
              },
              ...user.devices
                .filter((device) => device.id !== sessionId)
                .map((device) => ({ ...device, current: false })),
            ].slice(0, 6),
          }
        : user,
    ),
  }));

  cookieStore.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;

  if (sessionId) {
    await writeDb((db) => ({
      ...db,
      sessions: db.sessions.filter((session) => session.id !== sessionId),
      users: db.users.map((user) => ({
        ...user,
        devices: user.devices.map((device) => ({
          ...device,
          current: device.id === sessionId ? false : device.current,
        })),
      })),
    }));
  }

  cookieStore.delete(SESSION_COOKIE);
}

export async function getSessionUser() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;

  if (!sessionId) {
    return null;
  }

  const db = await readDb();
  const session = db.sessions.find((entry) => entry.id === sessionId);

  if (!session) {
    return null;
  }

  const user = db.users.find((entry) => entry.id === session.userId);

  if (!user) {
    return null;
  }

  const now = new Date().toISOString();

  await writeDb((current) => ({
    ...current,
    sessions: current.sessions.map((entry) =>
      entry.id === sessionId ? { ...entry, lastSeenAt: now } : entry,
    ),
    users: current.users.map((entry) =>
      entry.id === user.id
        ? {
            ...entry,
            devices: entry.devices.map((device) => ({
              ...device,
              current: device.id === sessionId,
              lastActiveAt: device.id === sessionId ? now : device.lastActiveAt,
            })),
          }
        : entry,
    ),
  }));

  return redactUser(user);
}

export async function requireSessionUser() {
  const user = await getSessionUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  return user;
}
