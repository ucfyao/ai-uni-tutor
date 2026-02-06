import { GraduationCap, MessageCircle, TrendingUp, Upload } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';

const stepIcons = [Upload, MessageCircle, GraduationCap, TrendingUp];

const HowItWorksSection = () => {
  const { t } = useLanguage();

  return (
    <section id="how-it-works" className="py-24 relative overflow-hidden">
      <div className="container mx-auto px-6 relative z-10">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">
            {t.howItWorks.title}{' '}
            <span className="gradient-text">{t.howItWorks.titleHighlight}</span>{' '}
            {t.howItWorks.titleEnd}
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">{t.howItWorks.subtitle}</p>
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Connection Line */}
          <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary/30 to-transparent -translate-y-1/2" />

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {t.howItWorks.steps.map((step, index) => {
              const Icon = stepIcons[index];
              return (
                <div key={index} className="relative group">
                  {/* Step Card */}
                  <div className="glass-card p-8 text-center hover:scale-105 transition-all duration-300">
                    {/* Step Number */}
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-primary to-accent rounded-full">
                      <span className="font-display font-bold text-sm text-primary-foreground">
                        {step.step}
                      </span>
                    </div>

                    {/* Icon */}
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-secondary flex items-center justify-center mb-6 mt-4 group-hover:bg-primary/20 transition-colors duration-300">
                      <Icon className="w-8 h-8 text-primary" />
                    </div>

                    <h3 className="font-display text-xl font-semibold mb-3">{step.title}</h3>
                    <p className="text-muted-foreground">{step.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
