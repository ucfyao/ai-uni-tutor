import { ArrowRight, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/i18n/LanguageContext';

const CTASection = () => {
  const { t } = useLanguage();

  return (
    <section className="py-24 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-background to-secondary/20" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/10 rounded-full blur-[100px]" />

      <div className="container mx-auto px-6 relative z-10">
        <div className="glass-card max-w-4xl mx-auto p-12 md:p-16 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/30 mb-8">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm text-primary">{t.cta.badge}</span>
          </div>

          <h2 className="font-display text-4xl md:text-5xl font-bold mb-6">
            {t.cta.title}
            <span className="gradient-text">{t.cta.titleHighlight}</span>
            {t.cta.titleEnd}
          </h2>

          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">{t.cta.subtitle}</p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button variant="hero" size="xl" asChild>
              <Link href="/login">
                {t.cta.startTrial}
                <ArrowRight className="w-5 h-5" />
              </Link>
            </Button>
            <Button variant="heroOutline" size="xl" asChild>
              <a href="mailto:ucfyao@gmail.com">{t.cta.contactUs}</a>
            </Button>
          </div>

          <p className="text-sm text-muted-foreground mt-6">{t.cta.note}</p>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
