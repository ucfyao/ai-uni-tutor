'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useCallback, useEffect, useState, useTransition } from 'react';
import { Button, Card, Group, Loader, NumberInput, Stack, Text } from '@mantine/core';
import {
  getReferralConfig,
  updateReferralConfig,
} from '@/app/actions/admin/referral-admin-actions';
import { useLanguage } from '@/i18n/LanguageContext';
import { showNotification } from '@/lib/notifications';
import type { ReferralConfigMap } from '@/types/referral';

const DEFAULT_CONFIG: ReferralConfigMap = {
  user_reward_days: 7,
  agent_commission_rate: 0.2,
  min_withdrawal_amount: 5000,
  referee_discount_percent: 10,
};

export function ReferralConfigTab() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();

  const [formValues, setFormValues] = useState<ReferralConfigMap>(DEFAULT_CONFIG);

  const { data: config, isLoading } = useQuery({
    queryKey: ['admin-referral-config'],
    queryFn: async () => {
      const result = await getReferralConfig();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });

  useEffect(() => {
    if (config) {
      setFormValues(config);
    }
  }, [config]);

  const handleSave = useCallback(() => {
    if (!config) return;
    startTransition(async () => {
      const keys = Object.keys(formValues) as (keyof ReferralConfigMap)[];
      const changedKeys = keys.filter((key) => formValues[key] !== config[key]);

      if (changedKeys.length === 0) {
        showNotification({ message: t.adminReferral.configSaved, color: 'green' });
        return;
      }

      let hasError = false;
      for (const key of changedKeys) {
        const result = await updateReferralConfig({ key, value: formValues[key] });
        if (!result.success) {
          showNotification({ message: result.error, color: 'red' });
          hasError = true;
          break;
        }
      }

      if (!hasError) {
        showNotification({ message: t.adminReferral.configSaved, color: 'green' });
        queryClient.invalidateQueries({ queryKey: ['admin-referral-config'] });
      }
    });
  }, [config, formValues, t, queryClient]);

  if (isLoading) {
    return (
      <Group justify="center" py="xl">
        <Loader size="sm" />
      </Group>
    );
  }

  return (
    <Card withBorder radius="lg" p="lg" maw={500}>
      <Stack gap="md">
        <Text fw={600} size="lg">
          {t.adminReferral.config}
        </Text>

        <NumberInput
          label={t.adminReferral.rewardDays}
          value={formValues.user_reward_days}
          onChange={(val) =>
            setFormValues((prev) => ({ ...prev, user_reward_days: Number(val) || 0 }))
          }
          min={0}
          max={365}
          suffix=" days"
        />

        <NumberInput
          label={t.adminReferral.commissionRate}
          value={formValues.agent_commission_rate * 100}
          onChange={(val) =>
            setFormValues((prev) => ({
              ...prev,
              agent_commission_rate: (Number(val) || 0) / 100,
            }))
          }
          min={0}
          max={100}
          decimalScale={1}
          suffix="%"
        />

        <NumberInput
          label={t.adminReferral.minWithdrawal}
          value={formValues.min_withdrawal_amount / 100}
          onChange={(val) =>
            setFormValues((prev) => ({
              ...prev,
              min_withdrawal_amount: Math.round((Number(val) || 0) * 100),
            }))
          }
          min={0}
          decimalScale={2}
          prefix="¥"
        />

        <NumberInput
          label={t.adminReferral.discountPercent}
          value={formValues.referee_discount_percent}
          onChange={(val) =>
            setFormValues((prev) => ({ ...prev, referee_discount_percent: Number(val) || 0 }))
          }
          min={0}
          max={100}
          suffix="%"
        />

        <Button onClick={handleSave} loading={isPending} mt="sm">
          {t.adminReferral.saveConfig}
        </Button>
      </Stack>
    </Card>
  );
}
