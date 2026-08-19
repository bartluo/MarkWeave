export type LicensePlan = 'free' | 'pro' | 'commercial' | 'trial'

export interface KeyPayload {
  sub: string
  plan: LicensePlan
  machines: number
  iat: number
  exp: number
  oid: string
}

export interface LicenseInfo {
  plan: LicensePlan
  customerEmail: string
  orderId: string
  issuedAt: number
  expiresAt: number
  machineLimit: number
  keyId: string
  activationId?: string
}

export type LicenseStatus = 'none' | 'activated' | 'expired' | 'invalid'

export interface LicenseState {
  status: LicenseStatus
  license?: LicenseInfo
  localVerified: boolean
  onlineValidated?: boolean
  lastValidatedAt?: number
  updatedAt: number
  error?: string
}

export interface MachineInfo {
  fingerprint: string
  name?: string
}

export interface ActivateRequest {
  key: string
  machine: MachineInfo
}

export interface ActivateResponse {
  ok: boolean
  activationId?: string
  license?: LicenseInfo
  error?: string
}

export interface ValidateRequest {
  key: string
  activationId: string
}

export interface ValidateResponse {
  ok: boolean
  revoked?: boolean
  license?: LicenseInfo
  error?: string
}

export interface DeactivateRequest {
  activationId: string
}

export interface DeactivateResponse {
  ok: boolean
  error?: string
}

export interface ActivateResult {
  ok: boolean
  state?: LicenseState
  error?: string
}
