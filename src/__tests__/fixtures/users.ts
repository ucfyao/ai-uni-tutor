/**
 * Test Fixtures - User Profiles
 *
 * Matches ProfileEntity from src/lib/domain/models/Profile.ts
 * and the profiles table Row from src/types/database.ts.
 */

import type { ProfileEntity } from '@/lib/domain/models/Profile';

/* ---------- Domain entities (camelCase) ---------- */

export const freeUser: ProfileEntity = {
  id: 'user-free-001',
  fullName: 'Free User',
  email: 'free@example.com',
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  stripePriceId: null,
  subscriptionStatus: 'inactive',
  currentPeriodEnd: null,
  role: 'user',
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
};

export const proUser: ProfileEntity = {
  id: 'user-pro-001',
  fullName: 'Pro User',
  email: 'pro@example.com',
  stripeCustomerId: 'cus_pro_001',
  stripeSubscriptionId: 'sub_pro_001',
  stripePriceId: 'price_pro_monthly',
  subscriptionStatus: 'active',
  currentPeriodEnd: new Date('2026-12-31T23:59:59Z'),
  role: 'user',
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-06-15T12:00:00Z'),
};

export const adminUser: ProfileEntity = {
  id: 'user-admin-001',
  fullName: 'Admin User',
  email: 'admin@example.com',
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  stripePriceId: null,
  subscriptionStatus: null,
  currentPeriodEnd: null,
  role: 'admin',
  createdAt: new Date('2024-06-01T00:00:00Z'),
  updatedAt: new Date('2024-06-01T00:00:00Z'),
};

/* ---------- Database rows (snake_case) ---------- */

export const freeUserRow = {
  id: freeUser.id,
  full_name: freeUser.fullName,
  email: freeUser.email,
  stripe_customer_id: freeUser.stripeCustomerId,
  stripe_subscription_id: freeUser.stripeSubscriptionId,
  stripe_price_id: freeUser.stripePriceId,
  subscription_status: freeUser.subscriptionStatus,
  current_period_end: null,
  role: freeUser.role,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

export const proUserRow = {
  id: proUser.id,
  full_name: proUser.fullName,
  email: proUser.email,
  stripe_customer_id: proUser.stripeCustomerId,
  stripe_subscription_id: proUser.stripeSubscriptionId,
  stripe_price_id: proUser.stripePriceId,
  subscription_status: proUser.subscriptionStatus,
  current_period_end: '2026-12-31T23:59:59Z',
  role: proUser.role,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-06-15T12:00:00Z',
};

export const adminUserRow = {
  id: adminUser.id,
  full_name: adminUser.fullName,
  email: adminUser.email,
  stripe_customer_id: adminUser.stripeCustomerId,
  stripe_subscription_id: adminUser.stripeSubscriptionId,
  stripe_price_id: adminUser.stripePriceId,
  subscription_status: adminUser.subscriptionStatus,
  current_period_end: null,
  role: adminUser.role,
  created_at: '2024-06-01T00:00:00Z',
  updated_at: '2024-06-01T00:00:00Z',
};
