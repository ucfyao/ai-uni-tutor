'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import {
  addAssignmentItem,
  batchUpdateAnswers,
  fetchAssignmentItems,
  mergeAssignmentItems,
  renameAssignment,
  splitAssignmentItem,
} from '@/app/actions/assignments';
import { useLanguage } from '@/i18n/LanguageContext';
import type { AssignmentItemEntity } from '@/lib/domain/models/Assignment';
import { showNotification } from '@/lib/notifications';
import { queryKeys } from '@/lib/query-keys';

export function useAssignmentItems(assignmentId: string, initialData: AssignmentItemEntity[]) {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const router = useRouter();

  const query = useQuery({
    queryKey: queryKeys.assignments.items(assignmentId),
    queryFn: async () => {
      const result = await fetchAssignmentItems({ assignmentId });
      if (!result.success) throw new Error(result.error);
      return result.data!;
    },
    initialData,
    staleTime: 30_000,
  });

  const invalidateItems = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.assignments.items(assignmentId) });
  }, [queryClient, assignmentId]);

  const addItemMutation = useMutation({
    mutationFn: async (data: {
      type?: string;
      content: string;
      referenceAnswer?: string;
      explanation?: string;
      points?: number;
      difficulty?: string;
    }) => {
      const result = await addAssignmentItem({
        assignmentId,
        type: data.type ?? '',
        content: data.content,
        referenceAnswer: data.referenceAnswer ?? '',
        explanation: data.explanation ?? '',
        points: data.points ?? 0,
        difficulty: data.difficulty ?? '',
      });
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      showNotification({ message: t.documentDetail.saved, color: 'green' });
      invalidateItems();
    },
    onError: (error: Error) => {
      showNotification({ title: t.common.error, message: error.message, color: 'red' });
    },
  });

  const renameMutation = useMutation({
    mutationFn: async (title: string) => {
      const result = await renameAssignment({ assignmentId, title });
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      showNotification({ message: t.documentDetail.nameUpdated, color: 'green' });
      router.refresh();
    },
    onError: (error: Error) => {
      showNotification({ title: t.common.error, message: error.message, color: 'red' });
    },
  });

  const mergeMutation = useMutation({
    mutationFn: async (itemIds: string[]) => {
      const result = await mergeAssignmentItems({ assignmentId, itemIds });
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      showNotification({ message: t.documentDetail.saved, color: 'green' });
      invalidateItems();
    },
    onError: (error: Error) => {
      showNotification({ title: t.common.error, message: error.message, color: 'red' });
    },
  });

  const splitMutation = useMutation({
    mutationFn: async (data: { itemId: string; splitContent: [string, string] }) => {
      const result = await splitAssignmentItem({
        assignmentId,
        itemId: data.itemId,
        splitContent: data.splitContent,
      });
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      showNotification({ message: t.documentDetail.saved, color: 'green' });
      invalidateItems();
    },
    onError: (error: Error) => {
      showNotification({ title: t.common.error, message: error.message, color: 'red' });
    },
  });

  const batchAnswersMutation = useMutation({
    mutationFn: async (matches: Array<{ itemId: string; referenceAnswer: string }>) => {
      const result = await batchUpdateAnswers({ assignmentId, matches });
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (data) => {
      showNotification({
        message: t.knowledge.answersUpdated.replace('{count}', String(data!.updated)),
        color: 'green',
      });
      invalidateItems();
    },
    onError: (error: Error) => {
      showNotification({ title: t.common.error, message: error.message, color: 'red' });
    },
  });

  return {
    items: query.data ?? [],
    isLoading: query.isLoading,
    addItem: addItemMutation.mutateAsync,
    isAddingItem: addItemMutation.isPending,
    rename: renameMutation.mutateAsync,
    isRenaming: renameMutation.isPending,
    merge: mergeMutation.mutateAsync,
    isMerging: mergeMutation.isPending,
    split: splitMutation.mutateAsync,
    isSplitting: splitMutation.isPending,
    batchUpdateAnswers: batchAnswersMutation.mutateAsync,
    invalidateItems,
  };
}
