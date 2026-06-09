import type { BrowseFilters, BrowseSectionKey } from "@/types/anime";

/**
 * Small localStorage-backed helpers for browse personalization that lives only
 * in the browser (filter presets, recent searches). Server-side these are
 * no-ops/empty, so callers must use them from client components.
 */

export type FilterPreset = {
  id: string;
  name: string;
  filters: Partial<BrowseFilters>;
};

const PRESET_LIMIT = 12;
const RECENT_LIMIT = 8;
const RECENT_KEY = "celestia:browse:recent";

function presetKey(section: BrowseSectionKey): string {
  return `celestia:browse:presets:${section}`;
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && "localStorage" in window;
}

function readJson<T>(key: string, fallback: T): T {
  if (!isBrowser()) {
    return fallback;
  }
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  if (!isBrowser()) {
    return;
  }
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota or privacy-mode failures are non-fatal — the feature just no-ops.
  }
}

function createId(): string {
  if (isBrowser() && typeof window.crypto?.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `p_${Date.now().toString(36)}`;
}

export function loadFilterPresets(section: BrowseSectionKey): FilterPreset[] {
  const presets = readJson<FilterPreset[]>(presetKey(section), []);
  return Array.isArray(presets) ? presets : [];
}

export function saveFilterPreset(
  section: BrowseSectionKey,
  name: string,
  filters: BrowseFilters,
): FilterPreset[] {
  // Persist only the non-empty filter values to keep presets compact.
  const stored: Partial<BrowseFilters> = {};
  (Object.entries(filters) as Array<[keyof BrowseFilters, string]>).forEach(
    ([key, value]) => {
      if (value && !(key === "sortOrder" && value === "desc")) {
        stored[key] = value;
      }
    },
  );

  const existing = loadFilterPresets(section).filter(
    (preset) => preset.name !== name,
  );
  const next = [{ id: createId(), name, filters: stored }, ...existing].slice(
    0,
    PRESET_LIMIT,
  );
  writeJson(presetKey(section), next);
  return next;
}

export function deleteFilterPreset(
  section: BrowseSectionKey,
  id: string,
): FilterPreset[] {
  const next = loadFilterPresets(section).filter((preset) => preset.id !== id);
  writeJson(presetKey(section), next);
  return next;
}

export function loadRecentSearches(): string[] {
  const terms = readJson<string[]>(RECENT_KEY, []);
  return Array.isArray(terms) ? terms : [];
}

export function pushRecentSearch(term: string): string[] {
  const trimmed = term.trim();
  if (!trimmed) {
    return loadRecentSearches();
  }
  const existing = loadRecentSearches().filter(
    (item) => item.toLowerCase() !== trimmed.toLowerCase(),
  );
  const next = [trimmed, ...existing].slice(0, RECENT_LIMIT);
  writeJson(RECENT_KEY, next);
  return next;
}
