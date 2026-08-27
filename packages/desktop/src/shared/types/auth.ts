// =============================================================================
// Auth types — shared between main process, renderer and (future) auth server
// =============================================================================

/** Authentication provider */
export type AuthProvider = 'local' | 'google' | 'github'

/** Represents the current auth status from the main process perspective */
export interface AuthStatus {
  /** Whether the user is authenticated (cloud auth only) */
  authenticated: boolean
  /** Auth provider if cloud-authenticated */
  provider?: AuthProvider
  /** User email if available */
  email?: string
  /** Display name */
  displayName?: string
  /** Whether the machine has a locally-activated license key */
  hasLocalLicense: boolean
  /** Whether the user has a cloud-tied license (account-linked) */
  hasCloudLicense: boolean
  /** Whether the user should be prompted to link their local license to a cloud account */
  requiresMigration?: boolean
  /** ISO timestamp of last successful login */
  lastLoginAt?: number
}

/** Login credentials for local account */
export interface LoginCredentials {
  email: string
  password: string
}

/** Registration request for a new local account */
export interface RegisterRequest {
  email: string
  password: string
  displayName: string
}

/** Result of a login or register operation */
export interface AuthResult {
  ok: boolean
  token?: string
  refreshToken?: string
  expiresIn?: number
  error?: string
  user?: {
    id: string
    email: string
    displayName: string
    createdAt: number
  }
}

/** Minimal user profile returned after login */
export interface UserProfile {
  id: string
  email: string
  displayName: string
  avatarUrl?: string
  createdAt: number
  plans: UserPlanInfo[]
  devices: UserDeviceInfo[]
}

/** License plan info tied to a user account */
export interface UserPlanInfo {
  planId: string
  planType: 'free' | 'pro' | 'commercial' | 'trial'
  status: 'active' | 'expired' | 'cancelled'
  activatedAt: number
  expiresAt: number
  orderId?: string
}

/** Device info for cross-device license management */
export interface UserDeviceInfo {
  deviceId: string
  name: string
  fingerprint: string
  lastActiveAt: number
  isActive: boolean
}

/** Device list returned by the auth server */
export interface DeviceList {
  current: UserDeviceInfo
  devices: UserDeviceInfo[]
  limit: number
}

/** OAuth challenge for PKCE flow */
export interface OAuthChallenge {
  codeVerifier: string
  authUrl: string
  state: string
}

/** OAuth callback result (code + state exchanged for tokens) */
export interface OAuthTokenResponse {
  ok: boolean
  accessToken?: string
  refreshToken?: string
  expiresIn?: number
  error?: string
}

/** Link a local license key to a cloud account */
export interface LinkAccountRequest {
  licenseKey: string
  displayName?: string
}

/** Result of linking a license to an account */
export interface LinkAccountResult {
  ok: boolean
  error?: string
}

/** Migrate a local license to cloud (deactivate local, activate on account) */
export interface MigrateLicenseResult {
  ok: boolean
  error?: string
}

// ── 商业类型 ───────────────────────────────────────────────────────────────────

/** Billing cycle */
export type BillingCycle = 'monthly' | 'annual' | 'lifetime'

/** Subscription status */
export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'expired'
  | 'incomplete'

/** User's subscription */
export interface UserSubscription {
  id: string
  userId: string
  planId: string
  planType: 'free' | 'pro' | 'commercial' | 'trial'
  status: SubscriptionStatus
  billingCycle: BillingCycle
  currentPeriodStart: number
  currentPeriodEnd: number
  trialEndsAt?: number
  cancelAtPeriodEnd: boolean
  canceledAt?: number
  paymentMethod?: string
  orderId?: string
  createdAt: number
  updatedAt: number
}

/** Team info */
export interface Team {
  id: string
  name: string
  description?: string
  ownerId: string
  maxMembers: number
  planType: 'free' | 'pro' | 'commercial' | 'trial'
  status: 'active' | 'suspended' | 'canceled'
  createdAt: number
  updatedAt: number
}

/** Team member info */
export interface TeamMember {
  userId: string
  email: string
  displayName: string
  role: 'owner' | 'admin' | 'member'
}

/** Team detail response */
export interface TeamDetail extends Team {
  members: TeamMember[]
}

/** Notification */
export interface Notification {
  id: string
  type: string
  title: string
  message: string
  readAt?: number
  actionUrl?: string
  createdAt: number
}

/** Referral */
export interface Referral {
  id: string
  referrerUserId: string
  referredUserId?: string
  referralCode: string
  referredEmail?: string
  status: 'pending' | 'converted' | 'rejected'
  convertedAt?: number
  rewardCents?: number
  createdAt: number
}

/** Coupon info */
export interface CouponInfo {
  type: string
  value: number
  name: string
}

/** 客户端本地免费试用状态（7 天试用 + 3 天离线宽限） */
export interface TrialState {
  status: 'trial' | 'grace' | 'locked'
  trialStartedAt: number
  trialEndsAt: number
  graceEndsAt: number
  remainingMs: number
  graceRemainingMs: number
}
