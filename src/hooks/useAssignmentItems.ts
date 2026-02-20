'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import {
  addAssignmentItem,
  fetchAssignmentItems,
  renameAssignment,
  reorderAssignmentItems,
  updateAssignmentItems,
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

  const saveChangesMutation = useMutation({
    mutationFn: async (data: {
      updates: { id: string; content: string; metadata: Record<string, unknown> }[];
      deletedIds: string[];
    }) => {
      const result = await updateAssignmentItems({
        assignmentId,
        updates: data.updates,
        deletedIds: data.deletedIds,
      });
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

  const reorderMutation = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const result = await reorderAssignmentItems({ assignmentId, orderedIds });
      if (!result.success) throw new Error(result.error);
    },
    onMutate: async (orderedIds: string[]) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.assignments.items(assignmentId) });
      const previous = queryClient.getQueryData<AssignmentItemEntity[]>(
        queryKeys.assignments.items(assignmentId),
      );
      if (previous) {
        const itemMap = new Map(previous.map((item) => [item.id, item]));
        const reordered = orderedIds
          .map((id, idx) => {
            const item = itemMap.get(id);
            return item ? { ...item, orderNum: idx + 1 } : null;
          })
          .filter(Boolean) as AssignmentItemEntity[];
        queryClient.setQueryData(queryKeys.assignments.items(assignmentId), reordered);
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.assignments.items(assignmentId), context.previous);
      }
      showNotification({ title: t.common.error, message: 'Failed to reorder', color: 'red' });
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
    saveChanges: saveChangesMutation.mutateAsync,
    isSaving: saveChangesMutation.isPending,
    reorder: reorderMutation.mutateAsync,
    isReordering: reorderMutation.isPending,
    rename: renameMutation.mutateAsync,
    isRenaming: renameMutation.isPending,
    invalidateItems,
  };
}
