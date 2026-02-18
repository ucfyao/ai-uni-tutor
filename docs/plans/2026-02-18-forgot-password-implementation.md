# Forgot Password Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a complete forgot password flow using Supabase Auth's native `resetPasswordForEmail()` + `updateUser()`.

**Architecture:** Two-phase flow — (1) inline email form on login page sends reset email via Supabase, (2) dedicated `/reset-password` page receives the user after email callback and lets them set a new password. All token management handled by Supabase Auth.

**Tech Stack:** Next.js 16 App Router, Supabase Auth SSR, Mantine v8, Zod, Vitest

**Design Doc:** `docs/plans/2026-02-18-forgot-password-design.md`

---

### Task 1: Add i18n Translation Keys

**Files:**

- Modify: `src/i18n/translations.ts:615-641` (zh login block) and `:1314-1341` (en login block)

**Step 1: Add zh keys after line 641 (`strong: '强'`)**

In the `zh.login` object, add these keys before the closing `}`:

```typescript
      // existing keys above...
      weak: '弱',
      medium: '中',
      strong: '强',
      // forgot/reset password
      forgotPasswordTitle: '重置密码',
      forgotPasswordSubtitle: '输入你的邮箱以接收重置链接',
      sendResetLink: '发送重置链接',
      backToLogin: '返回登录',
      resetLinkSent: '如果该邮箱已注册，你将收到一封重置链接邮件。',
      newPassword: '新密码',
      newPasswordPlaceholder: '请输入新密码',
      confirmNewPassword: '确认新密码',
      confirmNewPasswordPlaceholder: '请再次输入新密码',
      resetPassword: '重置密码',
      passwordResetSuccess: '密码重置成功！正在跳转...',
      invalidResetLink: '此重置链接无效或已过期。',
      returnToLogin: '返回登录页',
      passwordsDoNotMatch: '两次输入的密码不一致',
    },
```

**Step 2: Add en keys after line 1341 (`strong: 'Strong'`)**

In the `en.login` object, add the same keys in English:

```typescript
      // existing keys above...
      weak: 'Weak',
      medium: 'Medium',
      strong: 'Strong',
      // forgot/reset password
      forgotPasswordTitle: 'Reset your password',
      forgotPasswordSubtitle: 'Enter your email to receive a reset link',
      sendResetLink: 'Send reset link',
      backToLogin: 'Back to login',
      resetLinkSent: 'If an account exists with this email, you\'ll receive a reset link.',
      newPassword: 'New password',
      newPasswordPlaceholder: 'Enter your new password',
      confirmNewPassword: 'Confirm new password',
      confirmNewPasswordPlaceholder: 'Re-enter your new password',
      resetPassword: 'Reset password',
      passwordResetSuccess: 'Password reset successfully! Redirecting...',
      invalidResetLink: 'This reset link is invalid or expired.',
      returnToLogin: 'Return to login',
      passwordsDoNotMatch: 'Passwords do not match',
    },
```

**Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors (both language objects must have matching keys)

**Step 4: Commit**

```bash
git add src/i18n/translations.ts
git commit -m "feat(ui): add i18n keys for forgot/reset password flow"
```

---

### Task 2: Add Zod Schema for Password Reset

**Files:**

- Modify: `src/lib/schemas.ts`

**Step 1: Add `resetPasswordSchema` to schemas.ts**

Add after the existing `signupSchema` (after line 23):

```typescript
export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, { message: 'Password must be at least 8 characters' })
      .regex(/[A-Z]/, { message: 'Password must contain at least one uppercase letter' })
      .regex(/[a-z]/, { message: 'Password must contain at least one lowercase letter' })
      .regex(/[0-9]/, { message: 'Password must contain at least one number' })
      .regex(/[^A-Za-z0-9]/, { message: 'Password must contain at least one special character' }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const requestResetSchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
});
```

**Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/schemas.ts
git commit -m "feat(auth): add Zod schemas for password reset"
```

---

### Task 3: Add `/reset-password` to Auth Callback Allowed Prefixes

**Files:**

- Modify: `src/app/(public)/auth/callback/route.ts:6-18`
- Test: `src/app/(public)/auth/callback/route.test.ts`

**Step 1: Write the failing test**

Add to the `sanitizeRedirectPath` describe block in `route.test.ts`, after the existing `'allows known internal paths'` test (around line 63):

```typescript
it('allows /reset-password path', () => {
  expect(sanitizeRedirectPath('/reset-password')).toBe('/reset-password');
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/(public)/auth/callback/route.test.ts`
Expected: FAIL — `/reset-password` returns `/` because it's not in allowed prefixes

**Step 3: Add `/reset-password` to ALLOWED_PATH_PREFIXES**

In `route.ts`, add `'/reset-password'` to the array (after `/assignment`, before `/help`):

```typescript
const ALLOWED_PATH_PREFIXES = [
  '/study',
  '/exam',
  '/lecture',
  '/admin',
  '/assignment',
  '/reset-password',
  '/help',
  '/personalization',
  '/pricing',
  '/settings',
  '/share',
  '/zh',
];
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/(public)/auth/callback/route.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/app/(public)/auth/callback/route.ts src/app/(public)/auth/callback/route.test.ts
git commit -m "feat(auth): allow /reset-password in auth callback redirect"
```

---

### Task 4: Add `/reset-password` to Middleware Public Routes

**Files:**

- Modify: `src/lib/supabase/middleware.ts:53-58`

**Step 1: Add `/reset-password` to public route check**

In `middleware.ts`, update the `isPublicRoute` check to include `/reset-password`:

```typescript
const isPublicRoute =
  pathname === '/' ||
  pathname === '/zh' ||
  pathname.startsWith('/login') ||
  pathname.startsWith('/auth') ||
  pathname.startsWith('/reset-password') ||
  pathname.startsWith('/share');
```

**Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/supabase/middleware.ts
git commit -m "feat(auth): add /reset-password to public routes in middleware"
```

---

### Task 5: Add `requestPasswordReset` Server Action

**Files:**

- Modify: `src/app/(public)/login/actions.ts`
- Create: `src/app/(public)/login/actions.test.ts`

**Step 1: Write the failing tests**

Create `src/app/(public)/login/actions.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockResetPasswordForEmail = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { resetPasswordForEmail: mockResetPasswordForEmail },
  }),
}));

vi.mock('@/lib/env', () => ({
  getEnv: vi.fn().mockReturnValue({
    NEXT_PUBLIC_SITE_URL: 'https://example.com',
  }),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

const { requestPasswordReset } = await import('./actions');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('requestPasswordReset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error for invalid email', async () => {
    const formData = new FormData();
    formData.append('email', 'not-an-email');

    const result = await requestPasswordReset(formData);

    expect(result).toEqual({ error: expect.any(String) });
    expect(mockResetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('calls resetPasswordForEmail with correct params', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: null });
    const formData = new FormData();
    formData.append('email', 'user@example.com');

    await requestPasswordReset(formData);

    expect(mockResetPasswordForEmail).toHaveBeenCalledWith('user@example.com', {
      redirectTo: 'https://example.com/auth/callback?next=/reset-password',
    });
  });

  it('returns success message regardless of email existence', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: null });
    const formData = new FormData();
    formData.append('email', 'user@example.com');

    const result = await requestPasswordReset(formData);

    expect(result).toEqual({ success: true });
  });

  it('returns error on Supabase failure', async () => {
    mockResetPasswordForEmail.mockResolvedValue({
      error: { message: 'Rate limit exceeded' },
    });
    const formData = new FormData();
    formData.append('email', 'user@example.com');

    const result = await requestPasswordReset(formData);

    expect(result).toEqual({ error: 'Rate limit exceeded' });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/(public)/login/actions.test.ts`
Expected: FAIL — `requestPasswordReset` is not exported from `./actions`

**Step 3: Implement `requestPasswordReset` in actions.ts**

Add to the end of `src/app/(public)/login/actions.ts`:

```typescript
export async function requestPasswordReset(formData: FormData) {
  const rawData = { email: formData.get('email') as string };

  const validation = requestResetSchema.safeParse(rawData);
  if (!validation.success) {
    return { error: validation.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(validation.data.email, {
    redirectTo: `${getEnv().NEXT_PUBLIC_SITE_URL}/auth/callback?next=/reset-password`,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
```

Also add the import at the top of the file:

```typescript
import { loginSchema, requestResetSchema, signupSchema } from '@/lib/schemas';
```

(Replace the existing `import { loginSchema, signupSchema } from '@/lib/schemas';`)

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/(public)/login/actions.test.ts`
Expected: All 4 tests PASS

**Step 5: Commit**

```bash
git add src/app/(public)/login/actions.ts src/app/(public)/login/actions.test.ts
git commit -m "feat(auth): add requestPasswordReset server action with tests"
```

---

### Task 6: Create `updatePassword` Server Action

**Files:**

- Create: `src/app/(public)/reset-password/actions.ts`
- Create: `src/app/(public)/reset-password/actions.test.ts`

**Step 1: Write the failing tests**

Create `src/app/(public)/reset-password/actions.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUpdateUser = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { updateUser: mockUpdateUser },
  }),
}));

const mockRedirect = vi.fn();
vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
}));

const mockRevalidatePath = vi.fn();
vi.mock('next/cache', () => ({
  revalidatePath: mockRevalidatePath,
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

const { updatePassword } = await import('./actions');

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function buildFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    fd.append(k, v);
  }
  return fd;
}

const VALID_PASSWORD = 'StrongPass1!';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('updatePassword', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error for password too short', async () => {
    const result = await updatePassword(
      buildFormData({ password: 'Ab1!', confirmPassword: 'Ab1!' }),
    );
    expect(result).toEqual({ error: expect.stringContaining('8 characters') });
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('returns error for password missing uppercase', async () => {
    const result = await updatePassword(
      buildFormData({ password: 'lowercase1!', confirmPassword: 'lowercase1!' }),
    );
    expect(result).toEqual({ error: expect.stringContaining('uppercase') });
  });

  it('returns error for password missing number', async () => {
    const result = await updatePassword(
      buildFormData({ password: 'StrongPass!', confirmPassword: 'StrongPass!' }),
    );
    expect(result).toEqual({ error: expect.stringContaining('number') });
  });

  it('returns error for password missing special character', async () => {
    const result = await updatePassword(
      buildFormData({ password: 'StrongPass1', confirmPassword: 'StrongPass1' }),
    );
    expect(result).toEqual({ error: expect.stringContaining('special') });
  });

  it('returns error when passwords do not match', async () => {
    const result = await updatePassword(
      buildFormData({ password: VALID_PASSWORD, confirmPassword: 'Different1!' }),
    );
    expect(result).toEqual({ error: expect.stringContaining('do not match') });
  });

  it('calls updateUser with new password on valid input', async () => {
    mockUpdateUser.mockResolvedValue({ error: null });

    await updatePassword(
      buildFormData({ password: VALID_PASSWORD, confirmPassword: VALID_PASSWORD }),
    );

    expect(mockUpdateUser).toHaveBeenCalledWith({ password: VALID_PASSWORD });
  });

  it('redirects to /study on success', async () => {
    mockUpdateUser.mockResolvedValue({ error: null });

    await updatePassword(
      buildFormData({ password: VALID_PASSWORD, confirmPassword: VALID_PASSWORD }),
    );

    expect(mockRevalidatePath).toHaveBeenCalledWith('/', 'layout');
    expect(mockRedirect).toHaveBeenCalledWith('/study');
  });

  it('returns error on Supabase failure', async () => {
    mockUpdateUser.mockResolvedValue({
      error: { message: 'Session expired' },
    });

    const result = await updatePassword(
      buildFormData({ password: VALID_PASSWORD, confirmPassword: VALID_PASSWORD }),
    );

    expect(result).toEqual({ error: 'Session expired' });
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/(public)/reset-password/actions.test.ts`
Expected: FAIL — module not found

**Step 3: Create the server action**

Create `src/app/(public)/reset-password/actions.ts`:

```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { resetPasswordSchema } from '@/lib/schemas';
import { createClient } from '@/lib/supabase/server';

export async function updatePassword(formData: FormData) {
  const rawData = {
    password: formData.get('password') as string,
    confirmPassword: formData.get('confirmPassword') as string,
  };

  const validation = resetPasswordSchema.safeParse(rawData);
  if (!validation.success) {
    return { error: validation.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: validation.data.password,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/', 'layout');
  redirect('/study');
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/(public)/reset-password/actions.test.ts`
Expected: All 8 tests PASS

**Step 5: Commit**

```bash
git add src/app/(public)/reset-password/actions.ts src/app/(public)/reset-password/actions.test.ts
git commit -m "feat(auth): add updatePassword server action with tests"
```

---

### Task 7: Update Login Page — Add Forgot Password Inline View

**Files:**

- Modify: `src/app/(public)/login/page.tsx`

**Context:** The login page currently has a `href="#"` anchor for "Forgot password?" at lines 284-290. Replace this with a state toggle that shows an email input + send button when clicked.

**Step 1: Add new state and import**

Add to the state declarations (after line 36 `const [shake, setShake] = useState(false);`):

```typescript
const [isForgotPassword, setIsForgotPassword] = useState(false);
const [resetLoading, setResetLoading] = useState(false);
```

Add `requestPasswordReset` to the import from `./actions` (line 24):

```typescript
import { login, requestPasswordReset, signup } from './actions';
```

**Step 2: Add reset handler function**

Add after the `handleAuth` function (after line 117):

```typescript
const handleResetRequest = async (e: React.FormEvent) => {
  e.preventDefault();

  const eErr = validateEmail(email);
  setEmailError(eErr);
  if (eErr) return;

  setResetLoading(true);
  setError(null);
  setSuccessMsg(null);

  try {
    const formData = new FormData();
    formData.append('email', email);
    const res = await requestPasswordReset(formData);
    if (res?.error) {
      setError(res.error);
      setShake(true);
      setTimeout(() => setShake(false), 600);
    } else if (res?.success) {
      setSuccessMsg(t.login.resetLinkSent);
    }
  } catch (err) {
    console.error(err);
    const msg = err instanceof Error ? err.message : t.login.unexpectedError;
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 600);
  } finally {
    setResetLoading(false);
  }
};
```

**Step 3: Update the title/subtitle to reflect forgot password mode**

Replace the title/subtitle section (lines 156-160) to handle all 3 modes:

```typescript
          <Title
            order={1}
            fw={700}
            className="login-page-title"
            style={{ fontSize: 'clamp(24px, 2.4vw, 32px)', lineHeight: 1.2 }}
          >
            {isForgotPassword
              ? t.login.forgotPasswordTitle
              : isSignUp
                ? t.login.joinTitle
                : t.login.welcomeBack}
          </Title>
          <Text c="dimmed" size="sm" fw={500}>
            {isForgotPassword
              ? t.login.forgotPasswordSubtitle
              : isSignUp
                ? t.login.joinSubtitle
                : t.login.readySubtitle}
          </Text>
```

**Step 4: Add forgot password form view**

Replace the existing `<form onSubmit={handleAuth}>` block (lines 205-313) with a conditional that shows either the forgot password form or the login/signup form:

```tsx
{
  isForgotPassword ? (
    <form onSubmit={handleResetRequest}>
      <Stack gap="sm">
        <TextInput
          label={t.login.email}
          placeholder={t.login.emailPlaceholder}
          required
          size="md"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (emailError) setEmailError(validateEmail(e.target.value));
          }}
          onBlur={(e) => setEmailError(validateEmail(e.currentTarget.value))}
          error={emailError}
          leftSection={<Mail size={16} style={{ color: 'var(--mantine-color-slate-5)' }} />}
          radius="md"
          styles={inputStyles}
          classNames={{ input: 'login-input' }}
        />

        <Button
          fullWidth
          size="lg"
          radius="md"
          type="submit"
          loading={resetLoading}
          variant="gradient"
          gradient={{ from: 'indigo.7', to: 'indigo.3', deg: 105 }}
          mt="sm"
          fw={600}
          py={12}
          style={{
            boxShadow: '0 2px 8px rgba(79, 70, 229, 0.3)',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          }}
          className="login-submit-btn"
        >
          {t.login.sendResetLink}
        </Button>

        <Center>
          <Anchor
            href="#"
            size="sm"
            fw={600}
            c="indigo.6"
            onClick={(e) => {
              e.preventDefault();
              setIsForgotPassword(false);
              setError(null);
              setSuccessMsg(null);
            }}
          >
            {t.login.backToLogin}
          </Anchor>
        </Center>
      </Stack>
    </form>
  ) : (
    <form onSubmit={handleAuth}>{/* ... existing login/signup form content unchanged ... */}</form>
  );
}
```

**Step 5: Replace the `href="#"` forgot password anchor**

Replace lines 284-290 (the existing forgot password link inside the login form):

```tsx
{
  !isSignUp && (
    <Group justify="flex-end" mt={4}>
      <Anchor
        href="#"
        size="sm"
        fw={600}
        c="indigo.6"
        onClick={(e) => {
          e.preventDefault();
          setIsForgotPassword(true);
          setError(null);
          setSuccessMsg(null);
        }}
      >
        {t.login.forgotPassword}
      </Anchor>
    </Group>
  );
}
```

**Step 6: Hide the OAuth section and login/signup toggle when in forgot password mode**

Wrap the Divider, OAuth buttons, and toggle link (lines 315-374) in a conditional:

```tsx
          {!isForgotPassword && (
            <>
              <Divider ... />
              <Group grow gap="xs"> ... </Group>
              <Center mt="lg"> ... </Center>
            </>
          )}
```

**Step 7: Verify types compile and lint passes**

Run: `npx tsc --noEmit && npm run lint`
Expected: No errors

**Step 8: Commit**

```bash
git add src/app/(public)/login/page.tsx
git commit -m "feat(ui): add forgot password inline view on login page"
```

---

### Task 8: Create Reset Password Page

**Files:**

- Create: `src/app/(public)/reset-password/page.tsx`

**Context:** This page is reached after clicking the email link → `/auth/callback` → redirect to `/reset-password`. The user has an active Supabase session at this point. The page shows a new password + confirm password form with strength indicator, matching the login page styling.

**Step 1: Create the page component**

Create `src/app/(public)/reset-password/page.tsx`:

```tsx
'use client';

import { AlertCircle, Check, Lock } from 'lucide-react';
import React, { useState } from 'react';
import {
  Alert,
  Anchor,
  Box,
  Button,
  Center,
  Container,
  Paper,
  PasswordInput,
  Progress,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { Logo } from '@/components/Logo';
import { LanguageProvider, useLanguage } from '@/i18n/LanguageContext';
import { updatePassword } from './actions';

function ResetPasswordForm() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState('');
  const [shake, setShake] = useState(false);
  const { t } = useLanguage();

  const validatePassword = (value: string) => {
    if (!value) return '';
    return value.length >= 8 ? '' : t.login.passwordTooShort;
  };

  const getPasswordStrength = (pw: string) => {
    let score = 0;
    if (pw.length >= 6) score++;
    if (pw.length >= 10) score++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return score;
  };

  const strengthColor = ['red', 'red', 'orange', 'yellow', 'green', 'green'] as const;
  const strengthLabel = [
    '',
    t.login.weak,
    t.login.weak,
    t.login.medium,
    t.login.strong,
    t.login.strong,
  ];
  const strength = getPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const pErr = validatePassword(password);
    setPasswordError(pErr);
    if (pErr) return;

    if (password !== confirmPassword) {
      setError(t.login.passwordsDoNotMatch);
      setShake(true);
      setTimeout(() => setShake(false), 600);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const formData = new FormData();
      formData.append('password', password);
      formData.append('confirmPassword', confirmPassword);
      const res = await updatePassword(formData);
      if (res?.error) {
        setError(res.error);
        setShake(true);
        setTimeout(() => setShake(false), 600);
      } else {
        setSuccessMsg(t.login.passwordResetSuccess);
      }
    } catch (err) {
      // redirect() throws a NEXT_REDIRECT error — this is expected on success
      if (err instanceof Error && err.message.includes('NEXT_REDIRECT')) return;
      console.error(err);
      const msg = err instanceof Error ? err.message : t.login.unexpectedError;
      setError(msg);
      setShake(true);
      setTimeout(() => setShake(false), 600);
    } finally {
      setLoading(false);
    }
  };

  const inputStyles = {
    label: {
      marginBottom: 6,
      fontWeight: 600,
      fontSize: 14,
      color: 'var(--mantine-color-text)',
    },
    input: {
      backgroundColor: 'var(--mantine-color-body)',
      border: '1px solid var(--mantine-color-default-border)',
      fontSize: 15,
      minHeight: 44,
      transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
    },
  };

  return (
    <Box
      className="login-page-bg"
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(16px, 3vw, 32px)',
        overflowY: 'auto',
      }}
    >
      <Container size={460} w="100%" px={0} style={{ position: 'relative', zIndex: 1 }}>
        <Stack align="center" gap="sm" mb="lg">
          <Logo size={52} alt="AI Uni Tutor" />
          <Title
            order={1}
            fw={700}
            className="login-page-title"
            style={{ fontSize: 'clamp(24px, 2.4vw, 32px)', lineHeight: 1.2 }}
          >
            {t.login.resetPassword}
          </Title>
          <Text c="dimmed" size="sm" fw={500}>
            {t.login.passwordHint}
          </Text>
        </Stack>

        <Paper
          radius="lg"
          p={28}
          className="login-page-card"
          style={shake ? { animation: 'shake 0.5s ease-in-out' } : undefined}
        >
          {error && (
            <Alert
              icon={<AlertCircle size={14} />}
              color="red"
              mb="sm"
              radius="md"
              variant="light"
              styles={{
                root: { padding: '8px 12px', border: '1px solid var(--mantine-color-red-2)' },
              }}
            >
              {error}
            </Alert>
          )}

          {successMsg && (
            <Alert
              icon={<Check size={14} />}
              color="teal"
              mb="sm"
              radius="md"
              variant="light"
              styles={{
                root: {
                  padding: '8px 12px',
                  border: '1px solid var(--mantine-color-teal-2)',
                  backgroundColor: 'var(--mantine-color-teal-0)',
                },
                title: { fontWeight: 600, fontSize: 13 },
              }}
            >
              {successMsg}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <Stack gap="sm">
              <Box>
                <PasswordInput
                  label={t.login.newPassword}
                  placeholder={t.login.newPasswordPlaceholder}
                  required
                  size="md"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (passwordError) setPasswordError(validatePassword(e.target.value));
                  }}
                  onBlur={(e) => setPasswordError(validatePassword(e.currentTarget.value))}
                  error={passwordError}
                  leftSection={<Lock size={16} style={{ color: 'var(--mantine-color-slate-5)' }} />}
                  radius="md"
                  styles={inputStyles}
                  classNames={{ input: 'login-input' }}
                />
                {password && (
                  <Box mt={6}>
                    <Progress
                      value={(strength / 5) * 100}
                      color={strengthColor[strength]}
                      size="xs"
                      radius="xl"
                      mb={4}
                    />
                    <Text fz="xs" c={strengthColor[strength]}>
                      {strengthLabel[strength]}
                    </Text>
                  </Box>
                )}

                <PasswordInput
                  label={t.login.confirmNewPassword}
                  placeholder={t.login.confirmNewPasswordPlaceholder}
                  required
                  size="md"
                  mt="sm"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  leftSection={<Lock size={16} style={{ color: 'var(--mantine-color-slate-5)' }} />}
                  radius="md"
                  styles={inputStyles}
                  classNames={{ input: 'login-input' }}
                />
              </Box>

              <Button
                fullWidth
                size="lg"
                radius="md"
                type="submit"
                loading={loading}
                variant="gradient"
                gradient={{ from: 'indigo.7', to: 'indigo.3', deg: 105 }}
                mt="sm"
                fw={600}
                py={12}
                style={{
                  boxShadow: '0 2px 8px rgba(79, 70, 229, 0.3)',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
                className="login-submit-btn"
              >
                {t.login.resetPassword}
              </Button>
            </Stack>
          </form>

          <Center mt="lg">
            <Anchor href="/login" size="sm" fw={600} c="indigo.6">
              {t.login.returnToLogin}
            </Anchor>
          </Center>
        </Paper>

        <Text ta="center" size="sm" c="dimmed" mt="lg">
          {t.login.copyright.replace('{year}', String(new Date().getFullYear()))}
        </Text>
      </Container>
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-6px); }
          75% { transform: translateX(6px); }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0s !important; }
        }
      `}</style>
    </Box>
  );
}

export default function ResetPasswordPage() {
  return (
    <LanguageProvider>
      <ResetPasswordForm />
    </LanguageProvider>
  );
}
```

**Step 2: Verify types compile and lint passes**

Run: `npx tsc --noEmit && npm run lint`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/(public)/reset-password/page.tsx
git commit -m "feat(ui): add reset password page with strength indicator"
```

---

### Task 9: Final Verification

**Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Run lint**

Run: `npm run lint`
Expected: No errors

**Step 4: Run build**

Run: `npm run build`
Expected: Build succeeds

**Step 5: Commit any lint/format fixes if needed**

```bash
git add -A
git commit -m "chore: lint and format fixes"
```
