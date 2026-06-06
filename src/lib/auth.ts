import { cookies, headers } from "next/headers";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { getStore } from "@/lib/db";
import type {
  DeviceSession,
  PublicUser,
  SessionRecord,
  UserPreferences,
  UserRecord,
} from "@/types/account";

const SESSION_COOKIE = "celestia_session";
// Avoid a session write on every request; bump activity at most hourly.
const SESSION_TOUCH_INTERVAL_MS = 60 * 60 * 1000;

function createId(size = 16) {
  return randomBytes(size).toString("hex");
}

function defaultPreferences(): UserPreferences {
  return {
    titleLanguage: "english",
    hideAdultContent: true,
    autoplayTrailers: false,
    pauseHistory: false,
    defaultAudio: "sub",
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

function parseUserAgent(
  userAgent: string | null,
): Pick<DeviceSession, "platform" | "browser" | "label"> {
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
    isGuest: user.isGuest,
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
    notificationsLastReadAt: user.notificationsLastReadAt ?? null,
    notificationReadIds: user.notificationReadIds ?? [],
    notificationDismissedIds: user.notificationDismissedIds ?? [],
  };
}

export function getDefaultProfileAssets() {
  return {
    avatar: null,
    banner: null,
  };
}

export async function createGuestUser() {
  const now = new Date().toISOString();
  const assets = getDefaultProfileAssets();
  const id = createId();
  const user: UserRecord = {
    id,
    isGuest: true,
    email: null,
    passwordHash: null,
    displayName: "Guest",
    username: `guest_${id.slice(0, 8)}`,
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

  await getStore().insertUser(user);

  return user;
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
    isGuest: false,
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

  await getStore().insertUser(user);

  return redactUser(user);
}

export async function authenticateUser(email: string, password: string) {
  const user = await getStore().getUserByEmail(email.trim().toLowerCase());

  if (
    !user ||
    !user.passwordHash ||
    !verifyPassword(password, user.passwordHash)
  ) {
    throw new Error("Invalid email or password.");
  }

  return redactUser(user);
}

async function registerDevice(userId: string, sessionId: string, now: string) {
  const store = getStore();
  const headerStore = await headers();
  const userAgent = headerStore.get("user-agent") || "";
  const ua = parseUserAgent(userAgent);
  const user = await store.getUserById(userId);

  if (user) {
    user.devices = [
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
    ].slice(0, 6);

    await store.updateUser(user);
  }
}

export async function createSession(userId: string) {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const sessionId = createId();
  const userAgent = headerStore.get("user-agent") || "";
  const now = new Date().toISOString();
  const session: SessionRecord = {
    id: sessionId,
    userId,
    createdAt: now,
    lastSeenAt: now,
    userAgent,
  };

  await getStore().insertSession(session, { replaceForUserAgent: true });
  await registerDevice(userId, sessionId, now);

  cookieStore.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
  });

  return sessionId;
}

/**
 * Rotates the current session ID (e.g. after privilege escalation such as
 * linking an OAuth account) so a pre-escalation session token can never be
 * replayed with the new privileges.
 */
export async function regenerateSession(userId: string) {
  const cookieStore = await cookies();
  const currentSessionId = cookieStore.get(SESSION_COOKIE)?.value;

  if (currentSessionId) {
    await getStore().deleteSession(currentSessionId);
  }

  return createSession(userId);
}

export async function initGuestSession() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;

  if (sessionId) return null;

  const guest = await createGuestUser();
  return createSession(guest.id);
}

export async function clearSession() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;

  if (sessionId) {
    const store = getStore();
    const session = await store.getSession(sessionId);
    await store.deleteSession(sessionId);

    if (session) {
      const user = await store.getUserById(session.userId);
      if (user) {
        user.devices = user.devices.map((device) => ({
          ...device,
          current: device.id === sessionId ? false : device.current,
        }));
        await store.updateUser(user);
      }
    }
  }

  cookieStore.delete(SESSION_COOKIE);
}

export async function getSessionUser() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;

  if (!sessionId) {
    return null;
  }

  const store = getStore();
  const session = await store.getSession(sessionId);

  if (!session) {
    return null;
  }

  const now = Date.now();
  if (now - Date.parse(session.lastSeenAt) > SESSION_TOUCH_INTERVAL_MS) {
    // Throttled activity bump keeps guest cleanup honest without writing
    // on every request.
    store
      .touchSession(sessionId, new Date(now).toISOString())
      .catch(() => undefined);
  }

  const user = await store.getUserById(session.userId);

  if (!user) {
    return null;
  }

  return redactUser(user);
}

export async function requireSessionUser() {
  const user = await getSessionUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  return user;
}

/**
 * Whether the current viewer should see adult-only titles in discovery/search.
 * Defaults to hidden for signed-out viewers and anyone who hasn't opted in.
 */
export async function getViewerIncludesAdult(): Promise<boolean> {
  const user = await getSessionUser();
  return user ? !user.preferences.hideAdultContent : false;
}

/**
 * The current viewer's preferred title language for server-rendered titles.
 * Defaults to English for signed-out viewers.
 */
export async function getViewerTitleLanguage(): Promise<
  UserPreferences["titleLanguage"]
> {
  const user = await getSessionUser();
  return user?.preferences.titleLanguage ?? "english";
}
