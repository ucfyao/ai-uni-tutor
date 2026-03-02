'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import type { MockExam } from '@/types/exam';

export function useExamFilters(inProgress: MockExam[], completed: MockExam[]) {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const filterExam = useCallback(
    (mock: MockExam) => {
      if (
        debouncedSearch &&
        !mock.title.toLowerCase().includes(debouncedSearch.toLowerCase())
      ) {
        return false;
      }
      return true;
    },
    [debouncedSearch],
  );

  const filteredInProgress = useMemo(
    () => inProgress.filter(filterExam),
    [inProgress, filterExam],
  );

  const filteredCompleted = useMemo(
    () => completed.filter(filterExam),
    [completed, filterExam],
  );

  const hasActiveFilters = Boolean(searchInput);

  return {
    searchInput,
    setSearchInput,
    filteredInProgress,
    filteredCompleted,
    hasActiveFilters,
    clearAll: () => setSearchInput(''),
  };
}
