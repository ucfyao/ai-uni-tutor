'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { fetchCourses, fetchUniversities } from '@/app/actions/courses';
import type { CourseListItem, UniversityListItem } from '@/app/actions/courses';
import { queryKeys } from '@/lib/query-keys';

export function useCourseData(universityId?: string | null) {
  const { data: universities = [], isLoading: isLoadingUnis } = useQuery<UniversityListItem[]>({
    queryKey: queryKeys.universities.all,
    queryFn: async () => {
      const result = await fetchUniversities();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes — university/course data rarely changes
  });

  const { data: allCourses = [], isLoading: isLoadingCourses } = useQuery<CourseListItem[]>({
    queryKey: queryKeys.courses.all,
    queryFn: async () => {
      const result = await fetchCourses();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes — university/course data rarely changes
  });

  const courses = useMemo(() => {
    if (!universityId) return allCourses;
    return allCourses.filter((c) => c.universityId === universityId);
  }, [allCourses, universityId]);

  return {
    universities,
    courses,
    allCourses,
    isLoading: isLoadingUnis || isLoadingCourses,
  };
}
