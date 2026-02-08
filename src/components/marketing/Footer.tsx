import Image from 'next/image';
import Link from 'next/link';
import { useLanguage } from '@/i18n/LanguageContext';

const Footer = () => {
  const { t } = useLanguage();

  const footerLinkClassName =
    'inline-flex cursor-pointer items-center text-muted-foreground transition-colors hover:text-foreground hover:underline hover:decoration-primary/50 hover:underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm';

  return (
    <footer className="py-10 md:py-12 border-t border-border/50">
      <div className="container mx-auto px-6">
        <div className="grid md:grid-cols-4 gap-8 mb-10 md:mb-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <Link href="/" className="flex items-center gap-2">
                <div className="w-10 h-10 flex items-center justify-center">
                  <Image
                    src="/assets/logo.png"
                    alt="AI UniTutor"
                    width={40}
                    height={40}
                    className="w-10 h-10 object-contain"
                  />
                </div>
                <span className="font-display font-bold text-xl">AI UniTutor</span>
              </Link>
            </div>
            <p className="text-muted-foreground text-sm">{t.footer.tagline}</p>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-semibold mb-4">{t.footer.product.title}</h4>
            <ul className="space-y-2 text-muted-foreground text-sm">
              <li>
                <a href="#features" className={footerLinkClassName}>
                  {t.footer.product.features}
                </a>
              </li>
              <li>
                <a href="/pricing" className={footerLinkClassName}>
                  {t.footer.product.pricing}
                </a>
              </li>
              <li>
                <a href="#how-it-works" className={footerLinkClassName}>
                  {t.footer.product.changelog}
                </a>
              </li>
              <li>
                <a href="/login" className={footerLinkClassName}>
                  {t.footer.product.api}
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">{t.footer.support.title}</h4>
            <ul className="space-y-2 text-muted-foreground text-sm">
              <li>
                <a href="/help" className={footerLinkClassName}>
                  {t.footer.support.help}
                </a>
              </li>
              <li>
                <a href="#how-it-works" className={footerLinkClassName}>
                  {t.footer.support.tutorials}
                </a>
              </li>
              <li>
                <a href="mailto:ucfyao@gmail.com" className={footerLinkClassName}>
                  {t.footer.support.contact}
                </a>
              </li>
              <li>
                <a href="/help" className={footerLinkClassName}>
                  {t.footer.support.faq}
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">{t.footer.legal.title}</h4>
            <ul className="space-y-2 text-muted-foreground text-sm">
              <li>
                <a href="#" className={footerLinkClassName}>
                  {t.footer.legal.terms}
                </a>
              </li>
              <li>
                <a href="#" className={footerLinkClassName}>
                  {t.footer.legal.privacy}
                </a>
              </li>
              <li>
                <a href="#" className={footerLinkClassName}>
                  {t.footer.legal.cookies}
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="pt-6 md:pt-8 border-t border-border/50 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">{t.footer.copyright}</p>
          <div className="flex items-center gap-6 text-muted-foreground">
            <a href="#" className={`${footerLinkClassName} text-sm`}>
              {t.footer.social.item1}
            </a>
            <a href="#" className={`${footerLinkClassName} text-sm`}>
              {t.footer.social.item2}
            </a>
            <a href="#" className={`${footerLinkClassName} text-sm`}>
              {t.footer.social.item3}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
