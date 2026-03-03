'use client';

import { Check, Clock, Star, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  Badge,
  Button,
  Group,
  List,
  Loader,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { getAgentApplication, submitAgentApplication } from '@/app/actions/agent-actions';
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
  const [university, setUniversity] = useState('');
  const [wechat, setWechat] = useState('');
  const [phone, setPhone] = useState('');
  const [motivation, setMotivation] = useState('');

  useEffect(() => {
    if (!opened) return;
    setLoading(true);
    getAgentApplication()
      .then((res) => {
        if (res.success) {
          setApplication(res.data);
        }
      })
      .finally(() => setLoading(false));
  }, [opened]);

  const resetForm = () => {
    setFullName('');
    setUniversity('');
    setWechat('');
    setPhone('');
    setMotivation('');
    setSubmitted(false);
  };

  const handleSubmit = async () => {
    if (!fullName.trim() || !university.trim() || !motivation.trim()) return;

    setSubmitting(true);
    try {
      const result = await submitAgentApplication({
        fullName: fullName.trim(),
        university: university.trim(),
        contactInfo: {
          ...(wechat.trim() ? { wechat: wechat.trim() } : {}),
          ...(phone.trim() ? { phone: phone.trim() } : {}),
        },
        motivation: motivation.trim(),
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

  const isFormValid = fullName.trim() && university.trim() && motivation.trim();

  const renderContent = () => {
    if (loading) {
      return (
        <Group justify="center" py="xl">
          <Loader size="sm" />
        </Group>
      );
    }

    // Submitted just now
    if (submitted) {
      return (
        <Stack align="center" py="xl" gap="md">
          <Check size={48} color="var(--mantine-color-green-6)" />
          <Text fw={600} fz="lg" ta="center">
            {t.agentApply.pending}
          </Text>
          <Text c="dimmed" fz="sm" ta="center">
            {t.agentApply.pendingDesc}
          </Text>
          <Button variant="light" onClick={onClose}>
            {t.common.close}
          </Button>
        </Stack>
      );
    }

    // Existing application — pending
    if (application?.status === 'pending') {
      return (
        <Stack align="center" py="xl" gap="md">
          <Clock size={48} color="var(--mantine-color-yellow-6)" />
          <Text fw={600} fz="lg" ta="center">
            {t.agentApply.pending}
          </Text>
          <Text c="dimmed" fz="sm" ta="center">
            {t.agentApply.pendingDesc}
          </Text>
          <Button variant="light" onClick={onClose}>
            {t.common.close}
          </Button>
        </Stack>
      );
    }

    // Existing application — approved
    if (application?.status === 'approved') {
      return (
        <Stack align="center" py="xl" gap="md">
          <Star size={48} color="var(--mantine-color-indigo-6)" />
          <Badge variant="light" color="green" size="lg">
            {t.agentApply.approved}
          </Badge>
          <Button variant="light" onClick={onClose}>
            {t.common.close}
          </Button>
        </Stack>
      );
    }

    // Existing application — rejected
    if (application?.status === 'rejected') {
      return (
        <Stack align="center" py="xl" gap="md">
          <X size={48} color="var(--mantine-color-red-6)" />
          <Text fw={600} fz="lg" ta="center">
            {t.agentApply.rejected}
          </Text>
          <Text c="dimmed" fz="sm" ta="center">
            {t.agentApply.rejectedDesc}
          </Text>
          <Button variant="light" color="indigo" onClick={handleReapply}>
            {t.agentApply.reapply}
          </Button>
        </Stack>
      );
    }

    // No application — show form
    return (
      <Stack gap="md">
        {/* Benefits */}
        <Stack gap="xs">
          <Text fw={600} fz="sm">
            {t.agentApply.benefits}
          </Text>
          <List size="sm" spacing="xs">
            <List.Item>{t.agentApply.benefit1}</List.Item>
            <List.Item>{t.agentApply.benefit2}</List.Item>
            <List.Item>{t.agentApply.benefit3}</List.Item>
            <List.Item>{t.agentApply.benefit4}</List.Item>
          </List>
        </Stack>

        {/* Form */}
        <TextInput
          label={t.agentApply.fullName}
          value={fullName}
          onChange={(e) => setFullName(e.currentTarget.value)}
          required
        />
        <TextInput
          label={t.agentApply.university}
          value={university}
          onChange={(e) => setUniversity(e.currentTarget.value)}
          required
        />
        <TextInput
          label={t.agentApply.wechat}
          value={wechat}
          onChange={(e) => setWechat(e.currentTarget.value)}
        />
        <TextInput
          label={t.agentApply.phone}
          value={phone}
          onChange={(e) => setPhone(e.currentTarget.value)}
        />
        <Textarea
          label={t.agentApply.motivation}
          placeholder={t.agentApply.motivationPlaceholder}
          value={motivation}
          onChange={(e) => setMotivation(e.currentTarget.value)}
          minRows={4}
          required
        />

        <Button color="indigo" onClick={handleSubmit} loading={submitting} disabled={!isFormValid}>
          {t.agentApply.submit}
        </Button>
      </Stack>
    );
  };

  return (
    <FullScreenModal opened={opened} onClose={onClose} title={t.agentApply.title}>
      {renderContent()}
    </FullScreenModal>
  );
}
