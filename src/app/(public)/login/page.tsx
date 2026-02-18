'use client';

import { AlertCircle, Check, Lock, Mail } from 'lucide-react';
import React, { useState } from 'react';
import {
  Alert,
  Anchor,
  Box,
  Button,
  Center,
  Container,
  Divider,
  Group,
  Paper,
  PasswordInput,
  Progress,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { Logo } from '@/components/Logo';
import { LanguageProvider, useLanguage } from '@/i18n/LanguageContext';
import { login, requestPasswordReset, signup } from './actions';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [shake, setShake] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const { t } = useLanguage();

  const validateEmail = (value: string) => {
    if (!value) return '';
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? '' : t.login.invalidEmail;
  };

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

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();

    const eErr = validateEmail(email);
    const pErr = validatePassword(password);
    setEmailError(eErr);
    setPasswordError(pErr);
    if (eErr || pErr) return;

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    const formData = new FormData();
    formData.append('email', email);
    formData.append('password', password);
    if (isSignUp) {
      formData.append('confirmPassword', confirmPassword);
    }

    try {
      if (isSignUp) {
        const res = await signup(formData);
        if (res?.error) {
          setError(res.error);
          setShake(true);
          setTimeout(() => setShake(false), 600);
        } else if (res?.success) {
          setSuccessMsg(res.success);
        }
      } else {
        const res = await login(formData);
        if (res?.error) {
          setError(res.error);
          setShake(true);
          setTimeout(() => setShake(false), 600);
        }
      }
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : t.login.unexpectedError;
      setError(msg);
      setShake(true);
      setTimeout(() => setShake(false), 600);
    } finally {
      setLoading(false);
    }
  };

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
              title={t.login.checkEmail}
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

          {isForgotPassword ? (
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
            <form onSubmit={handleAuth}>
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

                <Box>
                  <PasswordInput
                    label={t.login.password}
                    placeholder={
                      isSignUp
                        ? t.login.passwordPlaceholderSignup
                        : t.login.passwordPlaceholderLogin
                    }
                    required
                    size="md"
                    mt={2}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (passwordError) setPasswordError(validatePassword(e.target.value));
                    }}
                    onBlur={(e) => setPasswordError(validatePassword(e.currentTarget.value))}
                    error={passwordError}
                    leftSection={
                      <Lock size={16} style={{ color: 'var(--mantine-color-slate-5)' }} />
                    }
                    radius="md"
                    styles={inputStyles}
                    classNames={{ input: 'login-input' }}
                  />
                  {isSignUp && password && (
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
                  {isSignUp && !password && (
                    <Text size="xs" c="dimmed" mt={2} style={{ lineHeight: 1.35 }}>
                      {t.login.passwordHint}
                    </Text>
                  )}

                  {isSignUp && (
                    <PasswordInput
                      label={t.login.confirm}
                      placeholder={t.login.confirmPlaceholder}
                      required
                      size="md"
                      mt="sm"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      leftSection={
                        <Lock size={16} style={{ color: 'var(--mantine-color-slate-5)' }} />
                      }
                      radius="md"
                      styles={inputStyles}
                      classNames={{ input: 'login-input' }}
                    />
                  )}

                  {!isSignUp && (
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
                  )}
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
                  {isSignUp ? t.login.createAccount : t.login.signIn}
                </Button>
              </Stack>
            </form>
          )}

          {!isForgotPassword && (
            <>
              <Divider
                label={t.login.orContinueWith}
                labelPosition="center"
                my="lg"
                styles={{
                  label: { fontSize: 13, color: 'var(--mantine-color-slate-5)', fontWeight: 500 },
                }}
              />

              <Group grow gap="xs">
                <Button
                  variant="default"
                  size="md"
                  radius="md"
                  disabled
                  style={{
                    border: '1px solid var(--mantine-color-slate-2)',
                    backgroundColor: 'var(--mantine-color-body)',
                    color: 'var(--mantine-color-slate-6)',
                    fontWeight: 500,
                  }}
                >
                  Google
                </Button>
                <Button
                  variant="default"
                  size="md"
                  radius="md"
                  disabled
                  style={{
                    border: '1px solid var(--mantine-color-slate-2)',
                    backgroundColor: 'var(--mantine-color-body)',
                    color: 'var(--mantine-color-slate-6)',
                    fontWeight: 500,
                  }}
                >
                  GitHub
                </Button>
              </Group>

              <Center mt="lg">
                <Text size="sm" c="dimmed" span>
                  {isSignUp ? t.login.alreadyHaveAccount : t.login.newUser}
                  <Anchor<'a'>
                    href="#"
                    fw={600}
                    c="indigo.6"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      setIsSignUp(!isSignUp);
                      setError(null);
                      setSuccessMsg(null);
                      setConfirmPassword('');
                    }}
                  >
                    {isSignUp ? t.login.signIn : t.login.createAccount}
                  </Anchor>
                </Text>
              </Center>
            </>
          )}
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

export default function LoginPage() {
  return (
    <LanguageProvider>
      <LoginForm />
    </LanguageProvider>
  );
}
