/**
 * Centralized query key factory for TanStack Query.
 *
 * Follows the key factory pattern for consistent cache invalidation.
 * @see https://tkdodo.eu/blog/effective-react-query-keys
 */

export const queryKeys = {
  documents: {
    all: ['documents'] as const,
    byType: (docType: string) => ['documents', docType] as const,
  },
  sessions: {
    all: ['sessions'] as const,
  },
  profile: {
    all: ['profile'] as const,
  },
  universities: {
    all: ['universities'] as const,
  },
  courses: {
    all: ['courses'] as const,
    byUniversity: (uniId: string) => ['courses', uniId] as const,
  },
} as const;
