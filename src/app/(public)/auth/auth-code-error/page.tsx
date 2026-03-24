'use client';

import { AlertCircle, Check, Mail } from 'lucide-react';
import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import { Alert, Box, Button, Container, Paper, Stack, Text, TextInput, Title } from '@mantine/core';
import { Logo } from '@/components/Logo';
import { LanguageProvider, useLanguage } from '@/i18n/LanguageContext';
import { resendVerificationEmail } from './actions';

function parseHashParams(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const hash = window.location.hash.slice(1);
  const params = new URLSearchParams(hash);
  const result: Record<string, string> = {};
  params.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

function AuthCodeErrorContent() {
  const { t } = useLanguage();
  const [errorCode, setErrorCode] = useState('');
  const [errorDescription, setErrorDescription] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState('');

  useEffect(() => {
    const params = parseHashParams();
    setErrorCode(params.error_code ?? '');
    setErrorDescription(params.error_description ?? '');
  }, []);

  const isExpired = errorCode === 'otp_expired';

  const getErrorMessage = () => {
    if (isExpired) return t.login.authErrorExpired;
    if (errorDescription) return decodeURIComponent(errorDescription.replace(/\+/g, ' '));
    return t.login.authErrorDefault;
  };

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setResendError('');
    setResendSuccess(false);

    const formData = new FormData();
    formData.append('email', email);

    const result = await resendVerificationEmail(formData);
    setLoading(false);

    if (result.success) {
      setResendSuccess(true);
    } else {
      setResendError(result.error);
    }
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
            {t.login.authErrorTitle}
          </Title>
        </Stack>

        <Paper radius="lg" p={28} className="login-page-card">
          <Stack gap="md">
            <Alert
              icon={<AlertCircle size={14} />}
              color="red"
              radius="md"
              variant="light"
              styles={{
                root: { padding: '8px 12px', border: '1px solid var(--mantine-color-red-2)' },
              }}
            >
              {getErrorMessage()}
            </Alert>

            {isExpired && (
              <>
                {resendSuccess ? (
                  <Alert
                    icon={<Check size={14} />}
                    color="teal"
                    radius="md"
                    variant="light"
                    styles={{
                      root: {
                        padding: '8px 12px',
                        border: '1px solid var(--mantine-color-teal-2)',
                        backgroundColor: 'var(--mantine-color-teal-0)',
                      },
                    }}
                  >
                    {t.login.resendSuccess}
                  </Alert>
                ) : (
                  <form onSubmit={handleResend}>
                    <Stack gap="sm">
                      <TextInput
                        label={t.login.email}
                        placeholder={t.login.emailPlaceholder}
                        required
                        size="md"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        leftSection={
                          <Mail size={16} style={{ color: 'var(--mantine-color-slate-5)' }} />
                        }
                        radius="md"
                        styles={{
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
                          },
                        }}
                        classNames={{ input: 'login-input' }}
                      />

                      {resendError && (
                        <Alert
                          icon={<AlertCircle size={14} />}
                          color="red"
                          radius="md"
                          variant="light"
                          styles={{
                            root: {
                              padding: '8px 12px',
                              border: '1px solid var(--mantine-color-red-2)',
                            },
                          }}
                        >
                          {resendError}
                        </Alert>
                      )}

                      <Button
                        fullWidth
                        size="lg"
                        radius="md"
                        type="submit"
                        loading={loading}
                        variant="gradient"
                        gradient={{ from: 'violet.6', to: 'violet.3', deg: 105 }}
                        fw={600}
                        py={12}
                        style={{
                          boxShadow: '0 2px 8px rgba(139, 92, 246, 0.25)',
                        }}
                        className="login-submit-btn"
                      >
                        {t.login.resendVerification}
                      </Button>
                    </Stack>
                  </form>
                )}
              </>
            )}

            <Button
              component={Link}
              href="/login"
              fullWidth
              size="lg"
              radius="md"
              variant="default"
              fw={600}
              py={12}
              style={{
                border: '1px solid var(--mantine-color-default-border)',
              }}
            >
              {t.login.goToLogin}
            </Button>
          </Stack>
        </Paper>

        <Text ta="center" size="sm" c="dimmed" mt="lg">
          {t.login.copyright.replace('{year}', String(new Date().getFullYear()))}
        </Text>
      </Container>
    </Box>
  );
}

export default function AuthCodeErrorPage() {
  return (
    <LanguageProvider>
      <AuthCodeErrorContent />
    </LanguageProvider>
  );
}
