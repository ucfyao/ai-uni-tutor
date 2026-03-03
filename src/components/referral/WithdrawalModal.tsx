'use client';

import { useState } from 'react';
import { Button, NumberInput, Select, Stack, Text, TextInput } from '@mantine/core';
import { requestWithdrawal } from '@/app/actions/agent-actions';
import { FullScreenModal } from '@/components/FullScreenModal';
import { useLanguage } from '@/i18n/LanguageContext';
import { showNotification } from '@/lib/notifications';

interface WithdrawalModalProps {
  opened: boolean;
  onClose: () => void;
  balance: number; // cents
  minWithdrawal: number; // in cents
  onSuccess: () => void;
}

export function WithdrawalModal({
  opened,
  onClose,
  balance,
  minWithdrawal,
  onSuccess,
}: WithdrawalModalProps) {
  const { t } = useLanguage();
  const minWithdrawalCNY = minWithdrawal / 100;
  const [amount, setAmount] = useState<number | string>('');
  const [method, setMethod] = useState<string | null>(null);
  const [account, setAccount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const methodOptions = [
    { value: 'alipay', label: t.agentDashboard.alipay },
    { value: 'wechat', label: t.agentDashboard.wechatPay },
    { value: 'bank', label: t.agentDashboard.bankTransfer },
  ];

  const handleSubmit = async () => {
    setError(null);
    const amountNum = typeof amount === 'string' ? parseFloat(amount) : amount;

    if (!amountNum || amountNum <= 0) {
      setError(t.common.error);
      return;
    }

    const amountInCents = Math.round(amountNum * 100);

    if (amountInCents < minWithdrawal) {
      setError(t.agentDashboard.minWithdrawal.replace('{amount}', String(minWithdrawalCNY)));
      return;
    }

    if (amountInCents > balance) {
      setError(t.agentDashboard.insufficientBalance);
      return;
    }

    if (!method || !account.trim()) {
      setError(t.common.error);
      return;
    }

    setSubmitting(true);
    try {
      const result = await requestWithdrawal({
        amount: amountInCents,
        paymentMethod: { type: method, account: account.trim() },
      });
      if (result.success) {
        showNotification({ message: t.agentDashboard.withdraw, color: 'green' });
        onSuccess();
        onClose();
        setAmount('');
        setMethod(null);
        setAccount('');
      } else {
        setError(result.error);
      }
    } catch (err) {
      console.error('Withdrawal failed', err);
      setError(t.common.error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FullScreenModal opened={opened} onClose={onClose} title={t.agentDashboard.withdraw} size="sm">
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          {t.agentDashboard.balance}: {'\u00a5'}
          {(balance / 100).toFixed(2)}
        </Text>
        <Text size="xs" c="dimmed">
          {t.agentDashboard.minWithdrawal.replace('{amount}', String(minWithdrawalCNY))}
        </Text>

        <NumberInput
          label={t.agentDashboard.amount}
          placeholder="0.00"
          prefix={'\u00a5'}
          min={0}
          decimalScale={2}
          value={amount}
          onChange={setAmount}
        />

        <Select
          label={t.agentDashboard.method}
          data={methodOptions}
          value={method}
          onChange={setMethod}
          placeholder={t.agentDashboard.method}
        />

        <TextInput
          label={t.agentDashboard.account}
          placeholder={t.agentDashboard.accountPlaceholder}
          value={account}
          onChange={(e) => setAccount(e.currentTarget.value)}
        />

        {error && (
          <Text size="sm" c="red">
            {error}
          </Text>
        )}

        <Button onClick={handleSubmit} loading={submitting} fullWidth>
          {t.agentDashboard.withdraw}
        </Button>
      </Stack>
    </FullScreenModal>
  );
}
