const store = new Map<string, number[]>()

export function checkRateLimit(
  ip: string,
  opts: { windowMs?: number; max?: number } = {}
): { allowed: boolean; remaining: number } {
  const windowMs = opts.windowMs ?? 60_000
  const max = opts.max ?? 5
  const now = Date.now()
  const timestamps = (store.get(ip) ?? []).filter(t => now - t < windowMs)
  if (timestamps.length >= max) return { allowed: false, remaining: 0 }
  timestamps.push(now)
  store.set(ip, timestamps)
  return { allowed: true, remaining: max - timestamps.length }
}

export function getIp(req: Request): string {
  return (
    (req.headers as any).get?.('x-forwarded-for')?.split(',')[0]?.trim() ??
    (req.headers as any).get?.('x-real-ip') ??
    'unknown'
  )
}
