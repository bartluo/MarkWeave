// =============================================================================
// Business types — subscription, coupons, teams, analytics
// Designed to support future commercial scaling without breaking changes.
// =============================================================================

import type { LicensePlan } from './license'

// ── 订阅与套餐 ─────────────────────────────────────────────────────────────────

/** Billing cycle */
export type BillingCycle = 'monthly' | 'annual' | 'lifetime'

/** Subscription status */
export type SubscriptionStatus =
  | 'active'       // paying and active
  | 'trialing'     // in free trial period
  | 'past_due'     // payment failed, grace period
  | 'canceled'     // user initiated cancellation
  | 'expired'      // subscription ended, not renewed
  | 'incomplete'   // payment not yet confirmed
  | 'incomplete_expired' // payment attempt exhausted

/** A subscription plan (the offering, not the user's instance) */
export interface PlanDefinition {
  id: string
  name: string
  description: string
  /** Maps to LicensePlan: free | pro | commercial | trial */
  licensePlan: LicensePlan
  priceCents: number           // price in smallest currency unit
  billingCycle: BillingCycle
  features: string[]           // feature keys enabled by this plan
  trialDays?: number           // if set, new subscribers get this many free days
  annualDiscount?: number      // percentage discount for annual billing
  maxDevices?: number          // device limit for this plan
  isPublic: boolean
  createdAt: number
  updatedAt: number
}

/** User's subscription instance */
export interface UserSubscription {
  id: string
  userId: string
  planId: string
  planType: LicensePlan
  status: SubscriptionStatus
  billingCycle: BillingCycle
  currentPeriodStart: number
  currentPeriodEnd: number
  trialEndsAt?: number
  cancelAtPeriodEnd: boolean
  canceledAt?: number
  paymentMethod?: string       // last4 of card, or 'alipay' / 'wechat'
  stripeCustomerId?: string    // external provider reference
  orderId?: string
  createdAt: number
  updatedAt: number
}

// ── 优惠券与促销 ───────────────────────────────────────────────────────────────

/** Coupon usage type */
export type CouponType = 'percent' | 'fixed' | 'free_trial'

/** Coupon validity */
export type CouponStatus = 'active' | 'expired' | 'disabled' | 'max_redemptions'

export interface CouponDefinition {
  id: string
  code: string                 // user-facing code, e.g. "SUMMER20"
  name: string
  type: CouponType
  value: number                // percentage or fixed amount (in cents)
  minPurchaseCents?: number    // minimum order value to use coupon
  maxDiscountCents?: number    // cap on discount
  maxRedemptions?: number      // total uses across all users
  maxRedemptionsPerUser?: number
  applicablePlans?: string[]   // null = all plans
  validFrom: number
  validUntil: number
  status: CouponStatus
  createdAt: number
}

export interface CouponRedemption {
  id: string
  couponId: string
  userId: string
  orderId?: string
  discountCents: number
  redeemedAt: number
}

// ── 团队与家庭许可 ────────────────────────────────────────────────────────────

/** Team role */
export type TeamRole = 'owner' | 'admin' | 'member'

/** Invitation status */
export type TeamInvitationStatus = 'pending' | 'accepted' | 'expired' | 'cancelled'

export interface Team {
  id: string
  name: string
  description?: string
  ownerId: string
  maxMembers: number
  planType: LicensePlan        // team-level plan
  status: 'active' | 'suspended' | 'canceled'
  createdAt: number
  updatedAt: number
}

export interface TeamMember {
  id: string
  teamId: string
  userId: string
  role: TeamRole
  joinedAt: number
  lastActiveAt?: number
}

export interface TeamInvitation {
  id: string
  teamId: string
  code: string                 // unique invite code
  invitedEmail: string
  inviterUserId: string
  role: TeamRole
  status: TeamInvitationStatus
  expiresAt: number
  createdAt: number
}

// ── 使用分析 ──────────────────────────────────────────────────────────────────

/** Analytics event types tracked for business insights */
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
  | 'device_added'
  | 'device_removed'
  | 'feature_used'
  | 'session_started'
  | 'session_ended'

export interface AnalyticsEvent {
  id: string
  userId?: string
  deviceId?: string
  eventType: AnalyticsEventType
  eventData: Record<string, unknown>
  occurredAt: number
  createdAt: number
}

// ── 客户支持 ──────────────────────────────────────────────────────────────────

/** Support ticket status */
export type TicketStatus = 'open' | 'pending' | 'solved' | 'closed'

/** Support ticket priority */
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface SupportTicket {
  id: string
  userId: string
  subject: string
  description: string
  status: TicketStatus
  priority: TicketPriority
  category: 'billing' | 'technical' | 'feature_request' | 'bug' | 'other'
  assignedTo?: string          // support agent id
  resolvedAt?: number
  createdAt: number
  updatedAt: number
}

// ── 推荐系统 ──────────────────────────────────────────────────────────────────

export type ReferralStatus = 'pending' | 'converted' | 'rejected'

export interface Referral {
  id: string
  referrerUserId: string
  referredUserId?: string
  referralCode: string         // unique code for the referrer
  referredEmail?: string
  status: ReferralStatus
  convertedAt?: number
  rewardCents?: number
  createdAt: number
}

// ── 通知与消息 ────────────────────────────────────────────────────────────────

export type NotificationType =
  | 'license_expiring_soon'
  | 'license_expired'
  | 'payment_received'
  | 'payment_failed'
  | 'refund_processed'
  | 'trial_ending_soon'
  | 'team_invite'
  | 'ticket_updated'
  | 'feature_announcement'
  | 'price_change'
  | 'security_alert'

export interface Notification {
  id: string
  userId: string
  type: NotificationType
  title: string
  message: string
  readAt?: number
  actionUrl?: string
  createdAt: number
}

// ── 用户完整资料 (聚合视图) ───────────────────────────────────────────────────

export interface UserBusinessProfile {
  id: string
  email: string
  displayName: string
  avatarUrl?: string
  createdAt: number
  subscription?: UserSubscription
  coupons: CouponRedemption[]
  team?: {
    teamId: string
    teamName: string
    role: TeamRole
  }
  referrals: {
    total: number
    converted: number
    earningsCents: number
  }
  tickets: {
    open: number
    recent: SupportTicket[]
  }
  notifications: {
    unread: number
    recent: Notification[]
  }
}
