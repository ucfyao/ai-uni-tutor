'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { MockExam } from '@/types/exam';

function getExamDifficulty(mock: MockExam): string | null {
  const difficulties = mock.questions
    .map((q) => q.metadata?.difficulty)
    .filter((d): d is string => Boolean(d));
  if (difficulties.length === 0) return null;

  const counts = new Map<string, number>();
  for (const d of difficulties) {
    counts.set(d, (counts.get(d) || 0) + 1);
  }

  let maxCount = 0;
  let mode: string | null = null;
  for (const [d, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      mode = d;
    }
  }
  return mode;
}

export function useExamFilters(inProgress: MockExam[], completed: MockExam[]) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const urlSearch = searchParams.get('q') ?? '';
  const status = searchParams.get('status');
  const difficulty = searchParams.get('difficulty');

  const [searchInput, setSearchInput] = useState(urlSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(urlSearch);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Sync debounced search → URL
  useEffect(() => {
    if (debouncedSearch === urlSearch) return;
    const params = new URLSearchParams(searchParams.toString());
    if (debouncedSearch) {
      params.set('q', debouncedSearch);
    } else {
      params.delete('q');
    }
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only sync on debounced value change
  }, [debouncedSearch]);

  const updateUrl = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false });
    },
    [searchParams, router],
  );

  const setStatus = useCallback(
    (v: string | null) => updateUrl('status', v),
    [updateUrl],
  );

  const setDifficulty = useCallback(
    (v: string | null) => updateUrl('difficulty', v),
    [updateUrl],
  );

  const clearAll = useCallback(() => {
    setSearchInput('');
    setDebouncedSearch('');
    router.replace(window.location.pathname, { scroll: false });
  }, [router]);

  const filterExam = useCallback(
    (mock: MockExam) => {
      if (
        debouncedSearch &&
        !mock.title.toLowerCase().includes(debouncedSearch.toLowerCase())
      ) {
        return false;
      }
      if (difficulty) {
        const examDiff = getExamDifficulty(mock);
        if (examDiff !== difficulty) return false;
      }
      return true;
    },
    [debouncedSearch, difficulty],
  );

  const filteredInProgress = useMemo(() => {
    if (status === 'completed') return [];
    return inProgress.filter(filterExam);
  }, [inProgress, filterExam, status]);

  const filteredCompleted = useMemo(() => {
    if (status === 'in_progress') return [];
    return completed.filter(filterExam);
  }, [completed, filterExam, status]);

  const hasActiveFilters = Boolean(searchInput || status || difficulty);

  return {
    searchInput,
    setSearchInput,
    status,
    setStatus,
    difficulty,
    setDifficulty,
    clearAll,
    filteredInProgress,
    filteredCompleted,
    hasActiveFilters,
  };
}
