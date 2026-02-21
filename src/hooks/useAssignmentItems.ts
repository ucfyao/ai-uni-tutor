'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import {
  addAssignmentItem,
  fetchAssignmentItems,
  renameAssignment,
  saveAssignmentChanges,
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
      parentItemId?: string | null;
      orderNum?: number;
      title?: string;
    }) => {
      const result = await addAssignmentItem({
        assignmentId,
        type: data.type ?? '',
        content: data.content,
        referenceAnswer: data.referenceAnswer ?? '',
        explanation: data.explanation ?? '',
        points: data.points ?? 0,
        difficulty: data.difficulty ?? '',
        parentItemId: data.parentItemId,
        orderNum: data.orderNum,
        title: data.title ?? '',
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

  const updateItemMutation = useMutation({
    mutationFn: async (data: {
      itemId: string;
      content: string;
      metadata: Record<string, unknown>;
    }) => {
      const result = await saveAssignmentChanges(
        assignmentId,
        [{ id: data.itemId, content: data.content, metadata: data.metadata }],
        [],
      );
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      showNotification({ message: t.documentDetail.saved, color: 'green' });
      invalidateItems();
    },
    onError: (error: Error) => {
      showNotification({ title: t.common.error, message: error.message, color: 'red' });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const result = await saveAssignmentChanges(assignmentId, [], [itemId]);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      showNotification({ message: t.toast.deletedSuccessfully, color: 'green' });
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

  return {
    items: query.data ?? [],
    isLoading: query.isLoading,
    addItem: addItemMutation.mutateAsync,
    isAddingItem: addItemMutation.isPending,
    updateItem: updateItemMutation.mutateAsync,
    deleteItem: deleteItemMutation.mutateAsync,
    rename: renameMutation.mutateAsync,
    invalidateItems,
  };
}
