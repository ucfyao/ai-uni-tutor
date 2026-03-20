import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://unitutor.ai';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/zh', '/partner', '/share/'],
      disallow: [
        '/study/',
        '/exam/',
        '/admin/',
        '/api/',
        '/auth/',
        '/help/',
        '/pricing/',
        '/settings/',
        '/personalization/',
        '/tools/',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
