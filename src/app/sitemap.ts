import type { MetadataRoute } from 'next';
import { getSessionRepository } from '@/lib/repositories/SessionRepository';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.aiunitutor.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: new Date(), changeFrequency: 'weekly', priority: 1.0 },
    { url: `${SITE_URL}/zh`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    {
      url: `${SITE_URL}/login`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/partner`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
  ];

  let dynamicRoutes: MetadataRoute.Sitemap = [];
  try {
    const repo = getSessionRepository();
    const sharedSessions = await repo.findSharedSessionIds();
    dynamicRoutes = sharedSessions.map((session) => ({
      url: `${SITE_URL}/share/${session.id}`,
      lastModified: new Date(session.updatedAt),
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    }));
  } catch {
    // If DB is unavailable, return only static routes
  }

  return [...staticRoutes, ...dynamicRoutes];
}
