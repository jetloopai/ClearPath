type EventName =
  | 'analysis_started'
  | 'analysis_completed'
  | 'email_submitted'
  | 'cook_county_cta_clicked'
  | 'share_deal_clicked'

export function trackEvent(name: EventName | string, properties?: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[analytics] ${name}`, properties ?? {})
  }

  // Fire-and-forget — don't await, don't block the caller
  fetch('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: name, properties, ts: Date.now() }),
  }).catch(() => {
    // Silently swallow — analytics should never break the app
  })
}
