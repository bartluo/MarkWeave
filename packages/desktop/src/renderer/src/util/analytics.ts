/**
 * Analytics tracking utility for MarkWeave.
 * Logs events to the auth server (if cloud-authenticated) and locally.
 * Designed to be called from renderer context via window.auth.logAnalytics.
 */

export type AnalyticsEventType =
  | 'license_activated'
  | 'license_deactivated'
  | 'license_expired'
  | 'payment_started'
  | 'payment_completed'
  | 'payment_failed'
  | 'refund_issued'
  | 'trial_started'
  | 'trial_ended'
  | 'coupon_redeemed'
  | 'plan_upgraded'
  | 'plan_downgraded'
  | 'feature_used'
  | 'session_started'
  | 'session_ended'
  | 'editor_open'
  | 'editor_close'
  | 'editor_save'
  | 'export_started'
  | 'export_completed'
  | 'theme_changed'

export interface AnalyticsEventData {
  [key: string]: unknown
}

let lastEventTime = 0
const BATCH_THRESHOLD_MS = 5000
let pendingEvents: Array<{ eventType: string; eventData?: AnalyticsEventData }> = []

/**
 * Log an analytics event. Batches rapid events and flushes periodically.
 */
export async function trackEvent(
  eventType: AnalyticsEventType,
  eventData?: AnalyticsEventData
): Promise<void> {
  const now = Date.now()
  pendingEvents.push({ eventType, eventData })

  // Flush if batch threshold reached or time gap exceeded
  if (pendingEvents.length >= 5 || now - lastEventTime >= BATCH_THRESHOLD_MS) {
    await flushEvents()
  }
}

async function flushEvents(): Promise<void> {
  if (pendingEvents.length === 0) return
  lastEventTime = Date.now()
  const events = [...pendingEvents]
  pendingEvents = []

  for (const event of events) {
    try {
      await window.auth.logAnalytics?.(event.eventType, event.eventData)
    } catch {
      // Silently fail — analytics should not break the app
    }
  }
}

// ── Convenience wrappers ─────────────────────────────────────────────────────

export const trackFeatureUse = (feature: string): void => {
  void trackEvent('feature_used', { feature })
}

export const trackSessionStart = (): void => {
  void trackEvent('session_started', { ts: Date.now() })
}

export const trackSessionEnd = (): void => {
  void trackEvent('session_ended', { ts: Date.now() })
}

export const trackEditorOpen = (filePath?: string): void => {
  void trackEvent('editor_open', { path: filePath })
}

export const trackEditorClose = (filePath?: string): void => {
  void trackEvent('editor_close', { path: filePath })
}

export const trackExportStart = (format: string): void => {
  void trackEvent('export_started', { format })
}

export const trackExportComplete = (format: string, sizeBytes?: number): void => {
  void trackEvent('export_completed', { format, sizeBytes })
}

export const trackThemeChange = (theme: string): void => {
  void trackEvent('theme_changed', { theme })
}
