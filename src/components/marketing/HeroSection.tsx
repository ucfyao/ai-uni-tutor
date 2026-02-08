import { ArrowRight, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/i18n/LanguageContext';

const HeroSection = () => {
  const { t } = useLanguage();

  return (
    <section className="relative min-h-[100svh] flex items-start justify-center overflow-hidden pt-24 md:pt-28 pb-16 bg-background">
      {/* Background Effects */}
      <div className="absolute inset-0 hero-radial" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pulse-glow" />
      <div
        className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-accent/10 rounded-full blur-[100px] pulse-glow"
        style={{ animationDelay: '1.5s' }}
      />

      {/* Grid Pattern */}
      <div className="absolute inset-0 hero-grid" />

      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/80 border border-border/50 mb-8 animate-fade-in-up opacity-0">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm text-muted-foreground">{t.hero.badge}</span>
          </div>

          {/* Main Heading */}
          <h1 className="font-display text-4xl sm:text-5xl md:text-7xl font-bold leading-tight mb-6 animate-fade-in-up opacity-0 animate-delay-100 text-foreground">
            {t.hero.title}
            <span className="gradient-text">{t.hero.titleHighlight}</span>
          </h1>

          {/* Subheading */}
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-in-up opacity-0 animate-delay-200">
            {t.hero.subtitle}
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up opacity-0 animate-delay-300">
            <Button variant="hero" size="xl" asChild>
              <Link href="/login">
                {t.hero.cta}
                <ArrowRight className="w-5 h-5" />
              </Link>
            </Button>
            <Button variant="heroOutline" size="xl" asChild>
              <Link href="#how-it-works">{t.hero.watchDemo}</Link>
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mt-12 sm:mt-16 pt-12 sm:pt-16 border-t border-border/30 animate-fade-in-up opacity-0 animate-delay-400">
            <div>
              <div className="font-display text-3xl sm:text-4xl font-bold gradient-text">50K+</div>
              <div className="text-muted-foreground mt-1">{t.hero.stats.students}</div>
            </div>
            <div>
              <div className="font-display text-3xl sm:text-4xl font-bold gradient-text">98%</div>
              <div className="text-muted-foreground mt-1">{t.hero.stats.satisfaction}</div>
            </div>
            <div>
              <div className="font-display text-3xl sm:text-4xl font-bold gradient-text">200+</div>
              <div className="text-muted-foreground mt-1">{t.hero.stats.subjects}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex items-start justify-center p-2">
          <div className="w-1 h-2 bg-muted-foreground/50 rounded-full" />
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
