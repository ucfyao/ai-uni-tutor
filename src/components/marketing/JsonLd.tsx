interface JsonLdProps {
  locale?: 'en' | 'zh';
}

export function JsonLd({ locale = 'en' }: JsonLdProps) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://unitutor.ai';

  const organization = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'AI Uni Tutor',
    url: siteUrl,
    logo: `${siteUrl}/assets/logo.png`,
  };

  const webApplication = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'AI Uni Tutor',
    url: siteUrl,
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Web',
    description:
      locale === 'zh'
        ? 'AI驱动的大学辅导平台'
        : 'AI-powered tutoring platform for university students',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      description: 'Free tier available',
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webApplication) }}
      />
    </>
  );
}
