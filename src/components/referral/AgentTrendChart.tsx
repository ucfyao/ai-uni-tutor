'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useCallback, useEffect, useState } from 'react';
import { Loader, Paper, Stack, Text } from '@mantine/core';
import { getAgentDailyTrend } from '@/app/actions/agent-actions';
import { useLanguage } from '@/i18n/LanguageContext';

interface TrendDataPoint {
  date: string;
  count: number;
}

export function AgentTrendChart() {
  const { t } = useLanguage();
  const [data, setData] = useState<TrendDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTrend = useCallback(async () => {
    try {
      const result = await getAgentDailyTrend();
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch trend data', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTrend();
  }, [fetchTrend]);

  return (
    <Paper
      withBorder
      p="md"
      radius="md"
      style={{
        background:
          'linear-gradient(180deg, var(--mantine-color-body) 0%, var(--mantine-color-default-hover) 100%)',
      }}
    >
      <Stack gap="md">
        <Text fw={700} size="lg">
          {t.agentDashboard.trend}
        </Text>
        {loading ? (
          <Stack align="center" justify="center" mih={250}>
            <Loader size="sm" />
          </Stack>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--mantine-color-default-border)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickFormatter={(value: string) => {
                  const d = new Date(value);
                  return `${d.getMonth() + 1}/${d.getDate()}`;
                }}
              />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip
                labelFormatter={(label) => {
                  const d = new Date(String(label));
                  return d.toLocaleDateString();
                }}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke="var(--mantine-color-pink-6)"
                strokeWidth={2}
                dot={{ r: 3, fill: 'var(--mantine-color-pink-6)' }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Stack>
    </Paper>
  );
}
