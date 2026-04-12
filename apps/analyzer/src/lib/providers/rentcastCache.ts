import { supabaseAdmin } from '@/lib/supabase-server'

// TTLs in milliseconds
const TTL_SUBJECT_MS = 30 * 24 * 60 * 60 * 1000  // 30 days — assessor data changes slowly
const TTL_VALUE_MS   =  7 * 24 * 60 * 60 * 1000  // 7 days  — sale comps / AVM
const TTL_RENT_MS    =  3 * 24 * 60 * 60 * 1000  // 3 days  — rental listings turn over faster

export interface RentCastCacheEntry {
  subject_raw: unknown | null
  value_raw: unknown | null
  rent_raw: unknown | null
}

function normalizeAddress(address: string): string {
  return address.trim().toLowerCase()
}

function isFresh(cachedAt: string | null | undefined, ttlMs: number): boolean {
  if (!cachedAt) return false
  return Date.now() - new Date(cachedAt).getTime() < ttlMs
}

export async function getCachedRentCast(address: string): Promise<{
  subject: unknown | null
  value: unknown | null
  rent: unknown | null
}> {
  try {
    const { data } = await supabaseAdmin
      .from('rentcast_cache')
      .select('subject_raw, value_raw, rent_raw, subject_cached_at, value_cached_at, rent_cached_at')
      .eq('address', normalizeAddress(address))
      .maybeSingle()

    if (!data) return { subject: null, value: null, rent: null }

    return {
      subject: isFresh(data.subject_cached_at, TTL_SUBJECT_MS) ? data.subject_raw : null,
      value:   isFresh(data.value_cached_at,   TTL_VALUE_MS)   ? data.value_raw   : null,
      rent:    isFresh(data.rent_cached_at,     TTL_RENT_MS)    ? data.rent_raw    : null,
    }
  } catch {
    // Cache read failure should never block an analysis
    return { subject: null, value: null, rent: null }
  }
}

export async function setCachedRentCast(
  address: string,
  updates: Partial<{ subject: unknown; value: unknown; rent: unknown }>
): Promise<void> {
  try {
    const now = new Date().toISOString()
    const key = normalizeAddress(address)

    const payload: Record<string, unknown> = { address: key, updated_at: now }
    if ('subject' in updates) { payload.subject_raw = updates.subject; payload.subject_cached_at = now }
    if ('value'   in updates) { payload.value_raw   = updates.value;   payload.value_cached_at   = now }
    if ('rent'    in updates) { payload.rent_raw     = updates.rent;    payload.rent_cached_at     = now }

    await supabaseAdmin
      .from('rentcast_cache')
      .upsert(payload, { onConflict: 'address' })
  } catch {
    // Cache write failure is non-fatal
  }
}
