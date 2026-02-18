# Forgot Password Feature Design

**Date:** 2026-02-18
**Approach:** Supabase Native Reset Flow

## Overview

Implement a complete forgot password flow using Supabase Auth's built-in `resetPasswordForEmail()` and `updateUser()` APIs. No custom token storage or email infrastructure needed.

## User Flow

### Phase 1 — Request Reset (Login Page)

1. User clicks "Forgot password?" link on login page
2. Login form hides, replaced by email input + "Send reset link" button + "Back to login" link
3. User enters email, clicks send
4. Server action calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: '/auth/callback?next=/reset-password' })`
5. Success message shown: "If an account exists with this email, you'll receive a reset link."
6. User receives email from Supabase with a magic link

### Phase 2 — Reset Password (`/reset-password` page)

1. User clicks the link in email → hits `/auth/callback` with recovery code
2. Existing callback exchanges code for session (user is now authenticated)
3. Callback redirects to `/reset-password`
4. `/reset-password` page shows: new password + confirm password + strength indicator
5. User submits → server action calls `supabase.auth.updateUser({ password })`
6. On success, redirect to `/study`

## Architecture

### Files to Create

- `src/app/(public)/reset-password/page.tsx` — Password reset form (new password, confirm, strength indicator). Same Mantine styling as login page.
- `src/app/(public)/reset-password/actions.ts` — Server action `updatePassword(formData)` that validates and calls `supabase.auth.updateUser({ password })`

### Files to Modify

- `src/app/(public)/login/page.tsx` — Replace `href="#"` link with toggle to "forgot password" view (email input + send button + back link). Add `isForgotPassword` state.
- `src/app/(public)/login/actions.ts` — Add `requestPasswordReset(formData)` server action
- `src/app/(public)/auth/callback/route.ts` — Add `/reset-password` to `ALLOWED_PATH_PREFIXES`
- `src/i18n/translations.ts` — Add new i18n keys for both en and zh
- `src/lib/supabase/middleware.ts` — Add `/reset-password` to public routes

### No Database Changes

Supabase Auth handles all token management and email delivery.

## Error Handling

### Request Phase (Login Page)

- **Empty/invalid email** — Client-side validation reuses existing `validateEmail()`, blocks submission
- **Email not registered** — Supabase does NOT reveal whether email exists. Always show same success message.
- **Rate limiting** — Supabase has built-in rate limits. Show Supabase error message if rate-limited.

### Reset Phase (`/reset-password`)

- **No active session** — User navigates directly without email link. Show "This link is invalid or expired" with link back to login.
- **Weak password** — Reuse `signupSchema` validation (8+ chars, uppercase, lowercase, number, special char) + strength indicator.
- **Passwords don't match** — Same confirm password validation as signup.
- **Expired/invalid link** — Auth callback redirects to `/auth/auth-code-error`.
- **Normal logged-in user** — Navigating to `/reset-password` while logged in works as "change password". No need to block.

## i18n Keys

New keys under `login` namespace (en / zh):

| Key                             | English                                                            | Chinese                                      |
| ------------------------------- | ------------------------------------------------------------------ | -------------------------------------------- |
| `forgotPasswordTitle`           | Reset your password                                                | 重置密码                                     |
| `forgotPasswordSubtitle`        | Enter your email to receive a reset link                           | 输入你的邮箱以接收重置链接                   |
| `sendResetLink`                 | Send reset link                                                    | 发送重置链接                                 |
| `backToLogin`                   | Back to login                                                      | 返回登录                                     |
| `resetLinkSent`                 | If an account exists with this email, you'll receive a reset link. | 如果该邮箱已注册，你将收到一封重置链接邮件。 |
| `newPassword`                   | New password                                                       | 新密码                                       |
| `newPasswordPlaceholder`        | Enter your new password                                            | 请输入新密码                                 |
| `confirmNewPassword`            | Confirm new password                                               | 确认新密码                                   |
| `confirmNewPasswordPlaceholder` | Re-enter your new password                                         | 请再次输入新密码                             |
| `resetPassword`                 | Reset password                                                     | 重置密码                                     |
| `passwordResetSuccess`          | Password reset successfully! Redirecting...                        | 密码重置成功！正在跳转...                    |
| `invalidResetLink`              | This reset link is invalid or expired.                             | 此重置链接无效或已过期。                     |
| `returnToLogin`                 | Return to login                                                    | 返回登录页                                   |
| `passwordsDoNotMatch`           | Passwords do not match                                             | 两次输入的密码不一致                         |

## Testing

### Server Action Tests

- `src/app/(public)/login/actions.test.ts` — Tests for `requestPasswordReset`:
  - Validates email format
  - Calls `supabase.auth.resetPasswordForEmail()` with correct params
  - Returns success message regardless of email existence
  - Returns error on Supabase failure

- `src/app/(public)/reset-password/actions.test.ts` — Tests for `updatePassword`:
  - Validates password strength
  - Validates passwords match
  - Calls `supabase.auth.updateUser({ password })`
  - Returns error on Supabase failure
  - Redirects to `/study` on success

### Auth Callback Test

- `src/app/(public)/auth/callback/route.test.ts` — Verify `/reset-password` is in `ALLOWED_PATH_PREFIXES`

No E2E tests — flow depends on Supabase email delivery.
