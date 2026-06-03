import { getStore } from "@/lib/db";
import type { StreamMappingRecord } from "@/types/account";

// Verified provider matches are reusable for a long time — the provider's
// internal anime ID does not change as new episodes air.
const MAPPING_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// Request-scoped/warm-instance cache so a single page render does not hit
// the database once per provider.
const memoryCache = new Map<string, StreamMappingRecord | null>();

function getKey(anilistId: number, providerId: string): string {
  return `${anilistId}:${providerId}`;
}

export function isMappingFresh(record: StreamMappingRecord): boolean {
  const verifiedAt = Date.parse(record.verifiedAt);
  return (
    Number.isFinite(verifiedAt) && Date.now() - verifiedAt < MAPPING_TTL_MS
  );
}

export async function getStreamMapping(
  anilistId: number,
  providerId: string,
): Promise<StreamMappingRecord | null> {
  const key = getKey(anilistId, providerId);

  if (memoryCache.has(key)) {
    return memoryCache.get(key) || null;
  }

  try {
    const record = await getStore().getStreamMapping(anilistId, providerId);
    const fresh = record && isMappingFresh(record) ? record : null;

    memoryCache.set(key, fresh);
    return fresh;
  } catch (error) {
    console.warn("Stream mapping lookup failed", error);
    return null;
  }
}

export async function saveStreamMapping(
  record: Omit<StreamMappingRecord, "verifiedAt">,
): Promise<void> {
  const fullRecord: StreamMappingRecord = {
    ...record,
    verifiedAt: new Date().toISOString(),
  };

  memoryCache.set(getKey(record.anilistId, record.providerId), fullRecord);

  try {
    await getStore().upsertStreamMapping(fullRecord);
  } catch (error) {
    console.warn("Stream mapping save failed", error);
  }
}

export async function clearStreamMapping(
  anilistId: number,
  providerId: string,
): Promise<void> {
  memoryCache.delete(getKey(anilistId, providerId));

  try {
    await getStore().deleteStreamMapping(anilistId, providerId);
  } catch (error) {
    console.warn("Stream mapping clear failed", error);
  }
}
