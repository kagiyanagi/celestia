const isProduction = process.env.NODE_ENV === "production";

function read(name: string): string {
  return (process.env[name] || "").trim();
}

/** First non-empty env var from the list (used for provider-injected aliases). */
function readFirst(...names: string[]): string {
  for (const name of names) {
    const value = read(name);
    if (value) return value;
  }
  return "";
}

/**
 * Central environment access with production guardrails. Modules should
 * read configuration through this instead of process.env so misconfiguration
 * fails loudly in one place.
 */
export const env = {
  isProduction,

  appSecret: read("APP_SECRET"),
  // Prefer the pooled connection string for serverless; fall back to the
  // non-pooled aliases Neon/Vercel may inject under different names.
  databaseUrl: readFirst(
    "DATABASE_URL",
    "POSTGRES_URL",
    "DATABASE_URL_UNPOOLED",
    "POSTGRES_URL_NON_POOLING",
  ),
  cronSecret: read("CRON_SECRET"),

  aniListClientId: read("ANILIST_CLIENT_ID"),
  aniListClientSecret: read("ANILIST_CLIENT_SECRET"),

  tmdbApiKey: read("TMDB_API_KEY"),
  animeScheduleToken: read("ANIMESCHEDULE_API_TOKEN"),
};

export type EnvIssue = {
  name: string;
  severity: "error" | "warning";
  message: string;
};

/** Returns configuration problems; errors are fatal in production. */
export function getEnvIssues(): EnvIssue[] {
  const issues: EnvIssue[] = [];

  if (!env.appSecret) {
    issues.push({
      name: "APP_SECRET",
      severity: isProduction ? "error" : "warning",
      message:
        "APP_SECRET is not set. Stored OAuth tokens cannot be encrypted without it. Generate one with: openssl rand -hex 32",
    });
  } else if (env.appSecret.length < 32) {
    issues.push({
      name: "APP_SECRET",
      severity: isProduction ? "error" : "warning",
      message: "APP_SECRET should be at least 32 characters of random data.",
    });
  }

  if (!env.databaseUrl && isProduction) {
    issues.push({
      name: "DATABASE_URL",
      severity: "warning",
      message:
        "DATABASE_URL is not set. Falling back to file storage, which DOES NOT PERSIST on serverless hosts - user accounts will be lost.",
    });
  }

  return issues;
}

let reported = false;

/** Logs env issues once per process; throws on errors in production. */
export function assertEnv() {
  if (reported) {
    return;
  }
  reported = true;

  const issues = getEnvIssues();
  const errors = issues.filter((issue) => issue.severity === "error");

  issues.forEach((issue) => {
    const log = issue.severity === "error" ? console.error : console.warn;
    log(`[env:${issue.severity}] ${issue.name}: ${issue.message}`);
  });

  if (errors.length > 0 && isProduction) {
    throw new Error(
      `Missing required environment configuration: ${errors
        .map((issue) => issue.name)
        .join(", ")}`,
    );
  }
}
