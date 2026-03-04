'use client';

import { AlertCircle, Building2, LogIn, UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import { Alert, Box, Button, Card, Center, Container, Stack, Text, Title } from '@mantine/core';
import { acceptInstitutionInvite } from '@/app/actions/institution-actions';
import { Logo } from '@/components/Logo';
import { LanguageProvider, useLanguage } from '@/i18n/LanguageContext';
import { showNotification } from '@/lib/notifications';

interface InviteInfo {
  institutionName: string;
  isActive: boolean;
  isExpired: boolean;
  isMaxed: boolean;
}

interface JoinPageClientProps {
  code: string;
  inviteInfo: InviteInfo | null;
  isLoggedIn: boolean;
}

function JoinPageContent({ code, inviteInfo, isLoggedIn }: JoinPageClientProps) {
  const { t } = useLanguage();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getInviteError = (): string | null => {
    if (!inviteInfo) return t.institution.inviteNotFound;
    if (!inviteInfo.isActive) return t.institution.inviteInactive;
    if (inviteInfo.isExpired) return t.institution.inviteExpired;
    if (inviteInfo.isMaxed) return t.institution.inviteMaxed;
    return null;
  };

  const inviteError = getInviteError();
  const isValidInvite = !inviteError;

  const handleAccept = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await acceptInstitutionInvite({ code });
      if (result.success) {
        showNotification({
          message: t.institution.joinSuccess,
          color: 'green',
        });
        router.push('/study');
      } else {
        const errorMessage =
          result.error === 'Already a member'
            ? t.institution.alreadyMember
            : result.error || t.institution.inviteError;
        setError(errorMessage);
      }
    } catch {
      setError(t.institution.inviteError);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginRedirect = () => {
    router.push(`/login?redirect=/join/${code}`);
  };

  return (
    <Box
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(16px, 3vw, 32px)',
      }}
    >
      <Container size={480} w="100%" px={0}>
        <Stack align="center" gap="sm" mb="lg">
          <Logo size={52} alt="AI Uni Tutor" />
          <Title
            order={1}
            fw={700}
            ta="center"
            style={{ fontSize: 'clamp(24px, 2.4vw, 32px)', lineHeight: 1.2 }}
          >
            {t.institution.joinTitle}
          </Title>
        </Stack>

        <Card radius="lg" p="xl" shadow="sm" withBorder>
          <Stack gap="lg" align="center">
            {inviteInfo && isValidInvite && (
              <>
                <Center>
                  <Box p="md" bg="violet.0" style={{ borderRadius: '50%' }}>
                    <Building2 size={32} color="var(--mantine-color-violet-6)" />
                  </Box>
                </Center>

                <Title order={3} ta="center" fw={600}>
                  {inviteInfo.institutionName}
                </Title>

                <Text c="dimmed" ta="center" size="md">
                  {t.institution.joinDescription.replace('{name}', inviteInfo.institutionName)}
                </Text>
              </>
            )}

            {inviteError && (
              <Alert
                icon={<AlertCircle size={16} />}
                color="red"
                radius="md"
                variant="light"
                w="100%"
              >
                {inviteError}
              </Alert>
            )}

            {error && (
              <Alert
                icon={<AlertCircle size={16} />}
                color="red"
                radius="md"
                variant="light"
                w="100%"
              >
                {error}
              </Alert>
            )}

            {isValidInvite && !isLoggedIn && (
              <Button
                fullWidth
                size="lg"
                radius="md"
                variant="gradient"
                gradient={{ from: 'violet.6', to: 'violet.3', deg: 105 }}
                leftSection={<LogIn size={18} />}
                onClick={handleLoginRedirect}
                fw={600}
                style={{
                  boxShadow: '0 2px 8px rgba(139, 92, 246, 0.25)',
                }}
              >
                {t.institution.joinLoginButton}
              </Button>
            )}

            {isValidInvite && isLoggedIn && (
              <Button
                fullWidth
                size="lg"
                radius="md"
                variant="gradient"
                gradient={{ from: 'violet.6', to: 'violet.3', deg: 105 }}
                leftSection={<UserPlus size={18} />}
                onClick={handleAccept}
                loading={loading}
                fw={600}
                style={{
                  boxShadow: '0 2px 8px rgba(139, 92, 246, 0.25)',
                }}
              >
                {t.institution.joinButton}
              </Button>
            )}
          </Stack>
        </Card>
      </Container>
    </Box>
  );
}

export function JoinPageClient(props: JoinPageClientProps) {
  return (
    <LanguageProvider>
      <JoinPageContent {...props} />
    </LanguageProvider>
  );
}
