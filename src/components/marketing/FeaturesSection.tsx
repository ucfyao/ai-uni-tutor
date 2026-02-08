import { BookOpen, Brain, Clock, MessageSquare, Target, Zap } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';

const featureIcons = [Brain, BookOpen, Clock, MessageSquare, Target, Zap];

const FeaturesSection = () => {
  const { t } = useLanguage();

  return (
    <section id="features" className="py-16 md:py-20 relative scroll-mt-24">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-secondary/20 to-background" />

      <div className="container mx-auto px-6 relative z-10">
        {/* Section Header */}
        <div className="text-center mb-10 md:mb-14">
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">
            {t.features.title} <span className="gradient-text">{t.features.titleHighlight}</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">{t.features.subtitle}</p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {t.features.items.map((feature, index) => {
            const Icon = featureIcons[index];
            return (
              <div
                key={index}
                className="glass-card p-6 md:p-8 hover:scale-[1.02] transition-all duration-300 group"
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="font-display text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
