'use client';

import { AlertCircle, Check, Lock, Mail } from 'lucide-react';
import Image from 'next/image';
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

  return (
    <Box
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(circle at 50% 10%, #f1f5f9 0%, #e2e8f0 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <Container size={460} w="100%">
        <Stack align="center" gap="xl" mb="xl">
          <Box mb={6} className="animate-in fade-in zoom-in duration-500">
            <Image src="/assets/logo.png" alt="AI Uni Tutor Logo" width={80} height={80} />
          </Box>

          <Box ta="center">
            <Title
              order={1}
              fw={900}
              style={{
                fontSize: '32px',
                letterSpacing: '-1px',
                background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {isSignUp ? 'Join AI Tutor' : 'Welcome Back'}
            </Title>
            <Text c="dimmed" size="lg" mt="xs" fw={500}>
              {isSignUp
                ? 'Start your personalized learning journey'
                : 'Continue where you left off'}
            </Text>
          </Box>
        </Stack>

        <Paper
          radius={24}
          p={40}
          bg="white"
          style={{
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.1)',
            border: '1px solid rgba(255,255,255,0.5)',
          }}
        >
          {error && (
            <Alert
              icon={<AlertCircle size={16} />}
              title="Authentication Error"
              color="red"
              mb="lg"
              radius="md"
              variant="light"
            >
              {error}
            </Alert>
          )}

          {successMsg && (
            <Alert
              icon={<Check size={16} />}
              title="Success"
              color="teal"
              mb="lg"
              radius="md"
              variant="light"
            >
              {successMsg}
            </Alert>
          )}

          <form onSubmit={handleAuth}>
            <Stack gap="md">
              <TextInput
                label="Email Address"
                placeholder="student@university.edu"
                required
                size="md"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftSection={<Mail size={18} className="text-gray-400" />}
                radius="md"
                styles={{
                  label: { marginBottom: '6px', fontWeight: 600, color: '#475569' },
                  input: {
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    transition: 'all 0.2s',
                  },
                }}
              />

              <Box>
                <PasswordInput
                  label="Password"
                  placeholder="Create a strong password"
                  required
                  size="md"
                  mt={4}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  leftSection={<Lock size={18} className="text-gray-400" />}
                  radius="md"
                  styles={{
                    label: { marginBottom: '6px', fontWeight: 600, color: '#475569' },
                    input: { backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' },
                  }}
                />

                {isSignUp && (
                  <PasswordInput
                    label="Confirm Password"
                    placeholder="Re-enter your password"
                    required
                    size="md"
                    mt="md"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    leftSection={<Lock size={18} className="text-gray-400" />}
                    radius="md"
                    styles={{
                      label: { marginBottom: '6px', fontWeight: 600, color: '#475569' },
                      input: { backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' },
                    }}
                  />
                )}

                {!isSignUp && (
                  <Group justify="flex-end" mt={6}>
                    <Anchor href="#" size="xs" fw={600} c="indigo.6">
                      Forgot password?
                    </Anchor>
                  </Group>
                )}
              </Box>

              <Button
                fullWidth
                size="lg"
                radius="xl"
                type="submit"
                loading={loading}
                variant="gradient"
                gradient={{ from: 'blue.6', to: 'indigo.6', deg: 90 }}
                mt="sm"
                styles={{
                  root: {
                    boxShadow: '0 10px 20px -5px rgba(67, 56, 202, 0.4)',
                    transition: 'transform 0.2s',
                  },
                  label: { fontWeight: 700, letterSpacing: '0.5px' },
                }}
              >
                {isSignUp ? 'Create Account' : 'Sign In'}
              </Button>
            </Stack>
          </form>

          <Divider label="Or continue with" labelPosition="center" my="xl" color="gray.2" />

          <Group grow>
            <Button
              variant="default"
              size="md"
              radius="lg"
              disabled
              style={{ border: '1px solid #e2e8f0', backgroundColor: 'white', color: '#64748b' }}
            >
              Google
            </Button>
            <Button
              variant="default"
              size="md"
              radius="lg"
              disabled
              style={{ border: '1px solid #e2e8f0', backgroundColor: 'white', color: '#64748b' }}
            >
              GitHub
            </Button>
          </Group>

          <Center mt="xl">
            <Text c="dimmed" size="sm">
              {isSignUp ? 'Already have an account? ' : 'New to AI Tutor? '}
              <Anchor<'a'>
                href="#"
                fw={700}
                c="indigo.6"
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

        <Text ta="center" size="xs" c="dimmed" mt="xl">
          &copy; {new Date().getFullYear()} AI Uni Tutor. All rights reserved.
        </Text>
      </Container>
    </Box>
  );
}
