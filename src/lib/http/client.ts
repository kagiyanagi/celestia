type NextFetchInit = RequestInit & {
  next?: {
    revalidate?: number | false;
    tags?: string[];
  };
};

type CacheEntry<T> = {
  value: T;
  staleUntil: number;
};

type ProviderFetchOptions = {
  provider: string;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  cacheKey?: string;
  staleTtlMs?: number;
  staleOnNonRetryable?: boolean;
  dedupe?: boolean;
};

const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 350;
const staleCache = new Map<string, CacheEntry<unknown>>();
const inFlightRequests = new Map<string, Promise<unknown>>();

export class ProviderFetchError extends Error {
  provider: string;
  status: number | null;
  retryable: boolean;
  retryAfterMs: number | null;

  constructor(input: {
    provider: string;
    message: string;
    status?: number | null;
    retryable?: boolean;
    retryAfterMs?: number | null;
    cause?: unknown;
  }) {
    super(input.message);
    this.name = "ProviderFetchError";
    this.provider = input.provider;
    this.status = input.status ?? null;
    this.retryable = Boolean(input.retryable);
    this.retryAfterMs = input.retryAfterMs ?? null;
    this.cause = input.cause;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRequestBodyKey(body: BodyInit | null | undefined): string {
  return typeof body === "string" ? body : "";
}

function createRequestKey(url: string, init: NextFetchInit): string {
  const method = init.method || "GET";
  return `${method}:${url}:${getRequestBodyKey(init.body)}`;
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function getRetryAfterMs(response: Response): number | null {
  const retryAfter = response.headers.get("retry-after");

  if (!retryAfter) {
    return null;
  }

  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }

  const date = Date.parse(retryAfter);
  if (Number.isFinite(date)) {
    return Math.max(0, date - Date.now());
  }

  return null;
}

function getBackoffMs(
  attempt: number,
  baseDelayMs: number,
  retryAfterMs: number | null,
): number {
  if (retryAfterMs !== null) {
    return retryAfterMs;
  }

  return baseDelayMs * 2 ** Math.max(0, attempt - 1);
}

function readStaleCache<T>(
  cacheKey: string | undefined,
  error: unknown,
): T | null {
  if (!cacheKey) {
    return null;
  }

  const entry = staleCache.get(cacheKey);
  if (!entry) {
    return null;
  }

  if (entry.staleUntil < Date.now()) {
    staleCache.delete(cacheKey);
    return null;
  }

  console.warn(`Using stale provider cache for ${cacheKey}`, error);
  return entry.value as T;
}

function writeStaleCache<T>(
  cacheKey: string | undefined,
  value: T,
  staleTtlMs: number | undefined,
) {
  if (!cacheKey || !staleTtlMs) {
    return;
  }

  staleCache.set(cacheKey, {
    value,
    staleUntil: Date.now() + staleTtlMs,
  });
}

async function fetchJsonOnce<T>(
  url: string,
  init: NextFetchInit,
  options: Required<
    Pick<
      ProviderFetchOptions,
      "provider" | "timeoutMs" | "retries" | "retryDelayMs"
    >
  >,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new ProviderFetchError({
        provider: options.provider,
        message: `${options.provider} request failed with HTTP ${response.status}`,
        status: response.status,
        retryable: isRetryableStatus(response.status),
        retryAfterMs: getRetryAfterMs(response),
      });
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ProviderFetchError) {
      throw error;
    }

    throw new ProviderFetchError({
      provider: options.provider,
      message:
        error instanceof Error
          ? `${options.provider} request failed: ${error.message}`
          : `${options.provider} request failed`,
      retryable: true,
      cause: error,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJsonWithRetry<T>(
  url: string,
  init: NextFetchInit,
  options: ProviderFetchOptions,
): Promise<T> {
  const normalizedOptions = {
    provider: options.provider,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    retries: options.retries ?? DEFAULT_RETRIES,
    retryDelayMs: options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS,
  };

  for (let attempt = 0; attempt <= normalizedOptions.retries; attempt += 1) {
    try {
      const value = await fetchJsonOnce<T>(url, init, normalizedOptions);
      writeStaleCache(options.cacheKey, value, options.staleTtlMs);
      return value;
    } catch (error) {
      const providerError =
        error instanceof ProviderFetchError
          ? error
          : new ProviderFetchError({
              provider: options.provider,
              message: `${options.provider} request failed`,
              retryable: true,
              cause: error,
            });
      const attemptsRemaining = attempt < normalizedOptions.retries;

      if (!providerError.retryable || !attemptsRemaining) {
        const canUseStale =
          providerError.retryable || options.staleOnNonRetryable === true;
        const cached = canUseStale
          ? readStaleCache<T>(options.cacheKey, providerError)
          : null;
        if (cached) {
          return cached;
        }

        throw providerError;
      }

      await sleep(
        getBackoffMs(
          attempt + 1,
          normalizedOptions.retryDelayMs,
          providerError.retryAfterMs,
        ),
      );
    }
  }

  throw new ProviderFetchError({
    provider: options.provider,
    message: `${options.provider} request failed`,
  });
}

export async function fetchJson<T>(
  url: string,
  init: NextFetchInit,
  options: ProviderFetchOptions,
): Promise<T> {
  const requestKey = options.cacheKey || createRequestKey(url, init);

  if (options.dedupe !== false) {
    const existing = inFlightRequests.get(requestKey);
    if (existing) {
      return existing as Promise<T>;
    }
  }

  const request = fetchJsonWithRetry<T>(url, init, options).finally(() => {
    if (options.dedupe !== false) {
      inFlightRequests.delete(requestKey);
    }
  });

  if (options.dedupe !== false) {
    inFlightRequests.set(requestKey, request);
  }

  return request;
}
