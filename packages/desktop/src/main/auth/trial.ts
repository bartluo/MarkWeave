import Store from 'electron-store'

const DAY_MS = 24 * 60 * 60 * 1000
const TRIAL_MS = (Number(process.env.MARKWEAVE_TRIAL_DAYS) || 7) * DAY_MS
const GRACE_MS = (Number(process.env.MARKWEAVE_TRIAL_GRACE_DAYS) || 3) * DAY_MS

export interface TrialState {
  status: 'trial' | 'grace' | 'locked'
  trialStartedAt: number
  trialEndsAt: number
  graceEndsAt: number
  remainingMs: number
  graceRemainingMs: number
}

interface TrialData {
  trialStartedAt?: number
}

class TrialStore {
  private store: Store<TrialData>

  constructor() {
    this.store = new Store<TrialData>({ name: 'trial' })
  }

  getState(): TrialState {
    let startedAt = this.store.get('trialStartedAt')
    const envStartedAt = Number(process.env.MARKWEAVE_TRIAL_STARTED_AT)
    if (Number.isFinite(envStartedAt) && envStartedAt > 0) {
      startedAt = envStartedAt
    }
    if (!startedAt) {
      startedAt = Date.now()
      this.store.set('trialStartedAt', startedAt)
    }

    const now = Date.now()
    const trialEndsAt = startedAt + TRIAL_MS
    const graceEndsAt = trialEndsAt + GRACE_MS
    let status: TrialState['status'] = 'trial'
    let remainingMs = trialEndsAt - now
    let graceRemainingMs = 0

    if (remainingMs <= 0) {
      graceRemainingMs = graceEndsAt - now
      if (graceRemainingMs > 0) {
        status = 'grace'
        remainingMs = 0
      } else {
        status = 'locked'
        remainingMs = 0
        graceRemainingMs = 0
      }
    }

    return {
      status,
      trialStartedAt: startedAt,
      trialEndsAt,
      graceEndsAt,
      remainingMs,
      graceRemainingMs
    }
  }
}

let instance: TrialStore | null = null
export const getTrialStore = (): TrialStore => {
  if (!instance) instance = new TrialStore()
  return instance
}
