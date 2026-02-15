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
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { Logo } from '@/components/Logo';
import { login, signup } from './actions';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
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
        } else if (res?.success) {
          setSuccessMsg(res.success);
        }
      } else {
        const res = await login(formData);
        if (res?.error) {
          setError(res.error);
        }
      }
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const inputStyles = {
    label: {
      marginBottom: 6,
      fontWeight: 600,
      fontSize: 14,
      color: 'var(--mantine-color-slate-7)',
    },
    input: {
      backgroundColor: 'var(--mantine-color-slate-0)',
      border: '1px solid var(--mantine-color-slate-2)',
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
            {isSignUp ? 'Join AI Tutor' : 'Welcome Back'}
          </Title>
          <Text c="dimmed" size="sm" fw={500}>
            {isSignUp
              ? 'Begin your personalized learning journey'
              : 'Your AI tutor is ready for you'}
          </Text>
        </Stack>

        <Paper radius="lg" p={28} className="login-page-card" style={{}}>
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
              title="Check your email"
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

          <form onSubmit={handleAuth}>
            <Stack gap="sm">
              <TextInput
                label="Email"
                placeholder="you@university.edu"
                required
                size="md"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftSection={<Mail size={16} style={{ color: 'var(--mantine-color-slate-5)' }} />}
                radius="md"
                styles={inputStyles}
                classNames={{ input: 'login-input' }}
              />

              <Box>
                <PasswordInput
                  label="Password"
                  placeholder={isSignUp ? 'Strong password' : 'Your password'}
                  required
                  size="md"
                  mt={2}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  leftSection={<Lock size={16} style={{ color: 'var(--mantine-color-slate-5)' }} />}
                  radius="md"
                  styles={inputStyles}
                  classNames={{ input: 'login-input' }}
                />
                {isSignUp && (
                  <Text size="xs" c="dimmed" mt={2} style={{ lineHeight: 1.35 }}>
                    8+ chars, upper, lower, number, symbol
                  </Text>
                )}

                {isSignUp && (
                  <PasswordInput
                    label="Confirm"
                    placeholder="Re-enter password"
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
                    <Anchor href="#" size="sm" fw={600} c="indigo.6">
                      Forgot password?
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
                gradient={{ from: 'indigo.5', to: 'violet.6', deg: 105 }}
                mt="sm"
                fw={600}
                py={12}
                style={{
                  boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
                className="login-submit-btn"
              >
                {isSignUp ? 'Create Account' : 'Sign In'}
              </Button>
            </Stack>
          </form>

          <Divider
            label="Or continue with"
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
              {isSignUp ? 'Already have an account? ' : 'New? '}
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
                {isSignUp ? 'Sign In' : 'Create Account'}
              </Anchor>
            </Text>
          </Center>
        </Paper>

        <Text ta="center" size="sm" c="dimmed" mt="lg">
          &copy; {new Date().getFullYear()} AI Uni Tutor
        </Text>
      </Container>
    </Box>
  );
}
