'use client';

import { Check, Clock, CreditCard, Gauge, Sparkles, Tag, Wallet, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Divider,
  Group,
  Loader,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
} from '@mantine/core';
import { getAgentApplication, submitAgentApplication } from '@/app/actions/agent-actions';
import { fetchUniversities } from '@/app/actions/courses';
import { FullScreenModal } from '@/components/FullScreenModal';
import { useLanguage } from '@/i18n/LanguageContext';
import { showNotification } from '@/lib/notifications';
import type { AgentApplicationEntity } from '@/types/referral';

interface AgentApplicationModalProps {
  opened: boolean;
  onClose: () => void;
}

export function AgentApplicationModal({ opened, onClose }: AgentApplicationModalProps) {
  const { t } = useLanguage();

  const [application, setApplication] = useState<AgentApplicationEntity | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Form fields
  const [fullName, setFullName] = useState('');
  const [universityId, setUniversityId] = useState<string | null>(null);
  const [coursesText, setCoursesText] = useState('');
  const [wechat, setWechat] = useState('');
  const [phone, setPhone] = useState('');
  const [motivation, setMotivation] = useState('');

  // Dropdown data
  const [universities, setUniversities] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    if (!opened) return;
    setLoading(true);
    Promise.all([getAgentApplication(), fetchUniversities()])
      .then(([appRes, uniRes]) => {
        if (appRes.success && appRes.data?.status !== 'rejected') setApplication(appRes.data);
        if (uniRes.success) {
          setUniversities(uniRes.data.map((u) => ({ value: u.id, label: u.name })));
        }
      })
      .finally(() => setLoading(false));
  }, [opened]);

  const resetForm = () => {
    setFullName('');
    setUniversityId(null);
    setCoursesText('');
    setWechat('');
    setPhone('');
    setMotivation('');
    setSubmitted(false);
  };

  const handleSubmit = async () => {
    if (!fullName.trim() || !universityId || !coursesText.trim()) return;

    setSubmitting(true);
    try {
      const selectedUni = universities.find((u) => u.value === universityId);

      const result = await submitAgentApplication({
        fullName: fullName.trim(),
        university: selectedUni?.label ?? '',
        contactInfo: {
          ...(wechat.trim() ? { wechat: wechat.trim() } : {}),
          ...(phone.trim() ? { phone: phone.trim() } : {}),
        },
        motivation: [`[${t.agentApply.courses}: ${coursesText.trim()}]`, motivation.trim()]
          .filter(Boolean)
          .join('\n'),
      });

      if (result.success) {
        setApplication(result.data);
        setSubmitted(true);
      } else {
        showNotification({ message: result.error, color: 'red' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleReapply = () => {
    setApplication(null);
    resetForm();
  };

  const isFormValid = fullName.trim() && universityId && coursesText.trim();

  const renderContent = () => {
    if (loading) {
      return (
        <Group justify="center" py={60}>
          <Loader size="sm" />
        </Group>
      );
    }

    // Status screen helper
    const statusScreen = (
      icon: React.ReactNode,
      title: string,
      desc: string,
      extra?: string,
      action?: { label: string; onClick: () => void; color?: string },
    ) => (
      <Stack align="center" py={60} gap="lg" px="md">
        <ThemeIcon variant="light" size="xl" radius="xl" color="gray">
          {icon}
        </ThemeIcon>
        <Stack gap={6} align="center">
          <Text fw={700} fz="lg" ta="center">
            {title}
          </Text>
          <Text c="dimmed" fz="sm" ta="center" maw={300}>
            {desc}
          </Text>
          {extra && (
            <Text c="dimmed" fz="xs" ta="center" mt={4}>
              {extra}
            </Text>
          )}
        </Stack>
        <Button variant="light" color={action?.color} onClick={action?.onClick ?? onClose} mt="xs">
          {action?.label ?? t.common.close}
        </Button>
      </Stack>
    );

    if (submitted || application?.status === 'pending') {
      return statusScreen(
        <Clock size={28} />,
        t.agentApply.pending,
        t.agentApply.pendingDesc,
        t.agentApply.pendingTimeframe,
      );
    }

    if (application?.status === 'approved') {
      return statusScreen(<Check size={28} />, t.agentApply.approved, t.agentApply.approvedDesc);
    }

    if (application?.status === 'rejected') {
      return statusScreen(
        <X size={28} />,
        t.agentApply.rejected,
        t.agentApply.rejectedDesc,
        undefined,
        { label: t.agentApply.reapply, onClick: handleReapply, color: 'pink' },
      );
    }

    // No application — show form
    return (
      <Stack gap={0}>
        {/* Hero — full-bleed warm gradient */}
        <Box
          px="xl"
          py={28}
          style={{
            background: 'linear-gradient(135deg, #fdf2f8 0%, #fff7ed 60%, #fef3c7 100%)',
            borderBottom: '1px solid var(--mantine-color-pink-1)',
          }}
        >
          <Stack gap={8} align="center" ta="center">
            <Sparkles size={28} color="#e11d48" strokeWidth={1.5} />
            <Text fw={800} fz="xl" lh={1.2} c="dark">
              {t.agentApply.heroTitle}
            </Text>
            <Text fz="sm" c="dimmed" maw={340} lh={1.5}>
              {t.agentApply.heroDesc}
            </Text>

            {/* Benefits as compact chips */}
            <Group gap={8} mt={4} justify="center" wrap="wrap">
              {[
                { icon: Tag, label: t.agentApply.benefit1 },
                { icon: CreditCard, label: t.agentApply.benefit2 },
                { icon: Gauge, label: t.agentApply.benefit3 },
                { icon: Wallet, label: t.agentApply.benefit4 },
              ].map((b) => (
                <Group
                  key={b.label}
                  gap={5}
                  wrap="nowrap"
                  py={3}
                  px={8}
                  style={{
                    background: 'rgba(255,255,255,0.7)',
                    borderRadius: 6,
                    border: '1px solid var(--mantine-color-pink-1)',
                  }}
                >
                  <b.icon size={12} color="var(--mantine-color-pink-5)" />
                  <Text fz={11} fw={500} c="dimmed">
                    {b.label}
                  </Text>
                </Group>
              ))}
            </Group>
          </Stack>
        </Box>

        {/* Form area with comfortable padding */}
        <Stack gap="md" px="xl" py="xl">
          <TextInput
            label={t.agentApply.fullName}
            value={fullName}
            onChange={(e) => setFullName(e.currentTarget.value)}
            required
            radius="md"
          />
          <Select
            label={t.agentApply.university}
            data={universities}
            value={universityId}
            onChange={setUniversityId}
            searchable
            clearable
            required
            radius="md"
          />
          <TextInput
            label={t.agentApply.courses}
            value={coursesText}
            onChange={(e) => setCoursesText(e.currentTarget.value)}
            placeholder={t.agentApply.coursesPlaceholder}
            required
            radius="md"
          />
          <SimpleGrid cols={2} spacing="sm">
            <TextInput
              label={t.agentApply.wechat}
              value={wechat}
              onChange={(e) => setWechat(e.currentTarget.value)}
              radius="md"
            />
            <TextInput
              label={t.agentApply.phone}
              value={phone}
              onChange={(e) => setPhone(e.currentTarget.value)}
              radius="md"
            />
          </SimpleGrid>
          <Textarea
            label={t.agentApply.motivation}
            placeholder={t.agentApply.motivationPlaceholder}
            value={motivation}
            onChange={(e) => setMotivation(e.currentTarget.value)}
            minRows={2}
            radius="md"
          />

          <Divider my={4} />

          <Button
            color="pink"
            size="md"
            onClick={handleSubmit}
            loading={submitting}
            disabled={!isFormValid}
            fullWidth
            radius="md"
          >
            {t.agentApply.submit}
          </Button>
        </Stack>
      </Stack>
    );
  };

  return (
    <FullScreenModal
      opened={opened}
      onClose={onClose}
      title={t.agentApply.title}
      size={540}
      radius="lg"
      styles={{
        header: {
          padding: 'var(--mantine-spacing-md) var(--mantine-spacing-xl)',
          borderBottom: '1px solid var(--mantine-color-gray-2)',
        },
        body: { padding: 0 },
        content: { overflow: 'hidden' },
      }}
    >
      {renderContent()}
    </FullScreenModal>
  );
}
