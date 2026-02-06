import { GraduationCap } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';

const Footer = () => {
  const { t } = useLanguage();

  return (
    <footer className="py-12 border-t border-border/50">
      <div className="container mx-auto px-6">
        <div className="grid md:grid-cols-4 gap-8 mb-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <GraduationCap className="w-6 h-6 text-primary-foreground" />
              </div>
              <span className="font-display font-bold text-xl">AI UniTutor</span>
            </div>
            <p className="text-muted-foreground text-sm">{t.footer.tagline}</p>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-semibold mb-4">{t.footer.product.title}</h4>
            <ul className="space-y-2 text-muted-foreground text-sm">
              <li>
                <a href="#features" className="hover:text-foreground transition-colors">
                  {t.footer.product.features}
                </a>
              </li>
              <li>
                <a href="/pricing" className="hover:text-foreground transition-colors">
                  {t.footer.product.pricing}
                </a>
              </li>
              <li>
                <a href="#how-it-works" className="hover:text-foreground transition-colors">
                  {t.footer.product.changelog}
                </a>
              </li>
              <li>
                <a href="/login" className="hover:text-foreground transition-colors">
                  {t.footer.product.api}
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">{t.footer.support.title}</h4>
            <ul className="space-y-2 text-muted-foreground text-sm">
              <li>
                <a href="/help" className="hover:text-foreground transition-colors">
                  {t.footer.support.help}
                </a>
              </li>
              <li>
                <a href="#how-it-works" className="hover:text-foreground transition-colors">
                  {t.footer.support.tutorials}
                </a>
              </li>
              <li>
                <a
                  href="mailto:ucfyao@gmail.com"
                  className="hover:text-foreground transition-colors"
                >
                  {t.footer.support.contact}
                </a>
              </li>
              <li>
                <a href="/help" className="hover:text-foreground transition-colors">
                  {t.footer.support.faq}
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">{t.footer.legal.title}</h4>
            <ul className="space-y-2 text-muted-foreground text-sm">
              <li>
                <a href="#" className="hover:text-foreground transition-colors">
                  {t.footer.legal.terms}
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-foreground transition-colors">
                  {t.footer.legal.privacy}
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-foreground transition-colors">
                  {t.footer.legal.cookies}
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-border/50 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">{t.footer.copyright}</p>
          <div className="flex items-center gap-6 text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors text-sm">
              {t.footer.social.item1}
            </a>
            <a href="#" className="hover:text-foreground transition-colors text-sm">
              {t.footer.social.item2}
            </a>
            <a href="#" className="hover:text-foreground transition-colors text-sm">
              {t.footer.social.item3}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
