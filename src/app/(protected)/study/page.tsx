import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';
import React from 'react';
import { fetchCourses, fetchUniversities } from '@/app/actions/courses';
import { queryKeys } from '@/lib/query-keys';
import { StudyPageClient } from './StudyPageClient';

export const dynamic = 'force-dynamic';

export default async function StudyPage() {
  const queryClient = new QueryClient();

  try {
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: queryKeys.universities.all,
        queryFn: async () => {
          const result = await fetchUniversities();
          if (!result.success) throw new Error(result.error);
          return result.data;
        },
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.courses.all,
        queryFn: async () => {
          const result = await fetchCourses();
          if (!result.success) throw new Error(result.error);
          return result.data;
        },
      }),
    ]);
  } catch {
    // Prefetch failed — client will fetch on mount (graceful degradation)
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <StudyPageClient />
    </HydrationBoundary>
  );
}
