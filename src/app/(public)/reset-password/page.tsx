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
