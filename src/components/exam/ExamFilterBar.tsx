'use client';

import { Search, X } from 'lucide-react';
import { ActionIcon, Button, Group, Select, TextInput } from '@mantine/core';

import { useLanguage } from '@/i18n/LanguageContext';

interface Props {
  searchInput: string;
  onSearchChange: (value: string) => void;
  status: string | null;
  onStatusChange: (value: string | null) => void;
  difficulty: string | null;
  onDifficultyChange: (value: string | null) => void;
  hasActiveFilters: boolean;
  onClearAll: () => void;
}

export function ExamFilterBar({
  searchInput,
  onSearchChange,
  status,
  onStatusChange,
  difficulty,
  onDifficultyChange,
  hasActiveFilters,
  onClearAll,
}: Props) {
  const { t } = useLanguage();

  return (
    <Group gap="sm" wrap="wrap">
      <TextInput
        placeholder={t.exam.searchExams}
        leftSection={<Search size={16} />}
        size="sm"
        style={{ flex: 1, minWidth: 200 }}
        value={searchInput}
        onChange={(e) => onSearchChange(e.currentTarget.value)}
        rightSection={
          searchInput ? (
            <ActionIcon
              size="sm"
              variant="subtle"
              color="gray"
              onClick={() => onSearchChange('')}
            >
              <X size={14} />
            </ActionIcon>
          ) : null
        }
      />
      <Select
        size="sm"
        w={150}
        placeholder={t.exam.allStatuses}
        clearable
        data={[
          { value: 'in_progress', label: t.exam.inProgress },
          { value: 'completed', label: t.exam.completed },
        ]}
        value={status}
        onChange={onStatusChange}
      />
      <Select
        size="sm"
        w={150}
        placeholder={t.exam.allDifficulties}
        clearable
        data={[
          { value: 'easy', label: t.exam.difficultyEasy },
          { value: 'medium', label: t.exam.difficultyMedium },
          { value: 'hard', label: t.exam.difficultyHard },
        ]}
        value={difficulty}
        onChange={onDifficultyChange}
      />
      {hasActiveFilters && (
        <Button
          variant="subtle"
          color="gray"
          size="sm"
          leftSection={<X size={14} />}
          onClick={onClearAll}
        >
          {t.exam.clearFilters}
        </Button>
      )}
    </Group>
  );
}
