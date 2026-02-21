'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { addExamQuestion } from '@/app/actions/documents';
import {
  deleteExamQuestion,
  fetchExamQuestions,
  renameExamPaper,
  updateSingleExamQuestion,
} from '@/app/actions/exams';
import { useLanguage } from '@/i18n/LanguageContext';
import { showNotification } from '@/lib/notifications';
import { queryKeys } from '@/lib/query-keys';
import type { ExamQuestion } from '@/types/exam';

export function useExamQuestions(paperId: string, initialData: ExamQuestion[]) {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const router = useRouter();

  const query = useQuery({
    queryKey: queryKeys.exams.questions(paperId),
    queryFn: async () => {
      const result = await fetchExamQuestions({ paperId });
      if (!result.success) throw new Error(result.error);
      return result.data!;
    },
    initialData,
    staleTime: 30_000,
  });

  const invalidateQuestions = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.exams.questions(paperId) });
  }, [queryClient, paperId]);

  const addQuestionMutation = useMutation({
    mutationFn: async (data: {
      content: string;
      answer?: string;
      explanation?: string;
      points?: number;
      type?: string;
    }) => {
      const result = await addExamQuestion({
        paperId,
        content: data.content,
        answer: data.answer ?? '',
        explanation: data.explanation ?? '',
        points: data.points ?? 0,
        type: data.type ?? 'short_answer',
      });
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      showNotification({ message: t.documentDetail.saved, color: 'green' });
      invalidateQuestions();
    },
    onError: (error: Error) => {
      showNotification({ title: t.common.error, message: error.message, color: 'red' });
    },
  });

  const updateQuestionMutation = useMutation({
    mutationFn: async (data: {
      questionId: string;
      content?: string;
      answer?: string;
      explanation?: string;
      points?: number;
      type?: string;
      options?: Record<string, string> | null;
      orderNum?: number;
    }) => {
      const result = await updateSingleExamQuestion({
        paperId,
        ...data,
      });
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      showNotification({ message: t.documentDetail.saved, color: 'green' });
      invalidateQuestions();
    },
    onError: (error: Error) => {
      showNotification({ title: t.common.error, message: error.message, color: 'red' });
    },
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: async (questionId: string) => {
      const result = await deleteExamQuestion({ paperId, questionId });
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      showNotification({ message: t.toast.deletedSuccessfully, color: 'green' });
      invalidateQuestions();
    },
    onError: (error: Error) => {
      showNotification({ title: t.common.error, message: error.message, color: 'red' });
    },
  });

  const renameMutation = useMutation({
    mutationFn: async (title: string) => {
      const result = await renameExamPaper({ paperId, title });
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
    questions: query.data ?? [],
    isLoading: query.isLoading,
    addQuestion: addQuestionMutation.mutateAsync,
    isAddingQuestion: addQuestionMutation.isPending,
    updateQuestion: updateQuestionMutation.mutateAsync,
    deleteQuestion: deleteQuestionMutation.mutateAsync,
    rename: renameMutation.mutateAsync,
    invalidateQuestions,
  };
}
