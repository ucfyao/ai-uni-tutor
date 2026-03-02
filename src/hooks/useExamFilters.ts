'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import type { MockExam } from '@/types/exam';

export type SortOrder = 'newest' | 'oldest';

export function useExamFilters(inProgress: MockExam[], completed: MockExam[]) {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');

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

  const sortExams = useCallback(
    (a: MockExam, b: MockExam) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
    },
    [sortOrder],
  );

  const filteredInProgress = useMemo(
    () => inProgress.filter(filterExam).sort(sortExams),
    [inProgress, filterExam, sortExams],
  );

  const filteredCompleted = useMemo(
    () => completed.filter(filterExam).sort(sortExams),
    [completed, filterExam, sortExams],
  );

  const hasActiveFilters = Boolean(searchInput);

  return {
    searchInput,
    setSearchInput,
    sortOrder,
    setSortOrder,
    filteredInProgress,
    filteredCompleted,
    hasActiveFilters,
    clearAll: () => setSearchInput(''),
  };
}
